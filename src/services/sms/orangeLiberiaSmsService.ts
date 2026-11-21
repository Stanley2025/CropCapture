/**
 * Orange Liberia SMS Gateway Service
 * 
 * Delivers weather warning SMS to smallholder farmers on Orange Liberia and Lonestar Cell MTN networks.
 * Strictly guarantees all messages stay <= 160 characters to fit a single GSM SMS segment.
 */

import { AlertDeliveryLog, WeatherAlert } from '../../types/weather';

export interface ISmsService {
  sendAlertSms(recipientPhone: string, alert: WeatherAlert): Promise<AlertDeliveryLog>;
}

export class OrangeLiberiaSmsService implements ISmsService {
  private readonly providerName = 'Orange Liberia';
  private senderName: string;
  private clientId?: string;
  private clientSecret?: string;

  constructor(
    senderName = 'CropCapture',
    clientId = process.env.ORANGE_LIBERIA_CLIENT_ID,
    clientSecret = process.env.ORANGE_LIBERIA_CLIENT_SECRET
  ) {
    this.senderName = senderName;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Formats a weather alert into a concise plain English SMS under 160 characters.
   * Example:
   * "CropCapture: Heavy rain expected tomorrow (~30mm, 80% chance) in Gbehley, Nimba. Harvest & dry rice today. Cover paddy." (121 chars)
   */
  public formatSmsMessage(alert: WeatherAlert): string {
    const prefix = 'CropCapture: ';
    const location = alert.district_name ? ` in ${alert.district_name}` : '';
    
    let raw = `${prefix}${alert.title}${location}. ${alert.action_advice}`;

    if (raw.length <= 160) {
      return raw;
    }

    // If longer than 160 chars, compress wording cleanly
    let compressed = `${prefix}${alert.title}. ${alert.action_advice}`;
    if (compressed.length <= 160) {
      return compressed;
    }

    // Hard truncate at 157 chars + '...'
    return compressed.substring(0, 157) + '...';
  }

  public async sendAlertSms(
    recipientPhone: string,
    alert: WeatherAlert
  ): Promise<AlertDeliveryLog> {
    const formattedMessage = this.formatSmsMessage(alert);
    const charCount = formattedMessage.length;

    // Safety assertion
    if (charCount > 160) {
      throw new Error(`SMS message exceeds 160 characters limit (${charCount} chars).`);
    }

    const logEntry: AlertDeliveryLog = {
      id: `sms_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      alert_id: alert.id,
      delivery_channel: 'sms',
      provider: this.providerName,
      recipient_phone: recipientPhone,
      message_body: formattedMessage,
      character_count: charCount,
      status: 'simulated',
      provider_response: 'Delivered via Orange Liberia SMS gateway (Mock/Sandbox)',
      sent_at: new Date().toISOString(),
    };

    // If live Orange Liberia credentials exist, attempt real API call
    if (this.clientId && this.clientSecret) {
      try {
        // Orange SMS API endpoint call
        const response = await fetch('https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B231/requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.clientSecret}`,
          },
          body: JSON.stringify({
            outboundSMSMessageRequest: {
              address: `tel:${recipientPhone}`,
              senderAddress: `tel:${this.senderName}`,
              outboundSMSTextMessage: {
                message: formattedMessage,
              },
            },
          }),
        });

        if (response.ok) {
          logEntry.status = 'delivered';
          logEntry.provider_response = await response.text();
        } else {
          logEntry.status = 'failed';
          logEntry.provider_response = `HTTP ${response.status}: ${await response.text()}`;
        }
      } catch (err: any) {
        logEntry.status = 'failed';
        logEntry.provider_response = err?.message || 'Network error';
      }
    }

    return logEntry;
  }
}

export const orangeSmsService = new OrangeLiberiaSmsService();
