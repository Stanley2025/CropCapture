-- AgriTrack Liberia Seed Data
-- Standard Liberian Crops, Varieties, Quality Templates & Benchmark Data

-- Insert Crops
INSERT INTO public.crops (id, name, code, category, default_unit, description) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Rice', 'RICE', 'Cereal / Staple', 'kg', 'Primary staple food of Liberia, grown across lowlands and uplands.'),
  ('11111111-1111-1111-1111-111111111102', 'Cassava', 'CASS', 'Root / Tuber', 'kg', 'Second staple crop, processed into gari, fufu, and flour.'),
  ('11111111-1111-1111-1111-111111111103', 'Maize', 'MAIZ', 'Cereal', 'kg', 'Yellow and white grain maize for household and livestock feed.'),
  ('11111111-1111-1111-1111-111111111104', 'Cocoa', 'COCO', 'Cash Crop', 'kg', 'High-value export cash crop cultivated primarily in Nimba, Bong, and Lofa.'),
  ('11111111-1111-1111-1111-111111111105', 'Coffee', 'COFF', 'Cash Crop', 'kg', 'Robusta and Liberica coffee beans grown in forested belts.'),
  ('11111111-1111-1111-1111-111111111106', 'Pepper', 'PEPP', 'Horticulture', 'kg', 'Hot chili peppers including Scotch Bonnet and local varieties.'),
  ('11111111-1111-1111-1111-111111111107', 'Plantain', 'PLAN', 'Fruit / Staple', 'bunches', 'Perennial staple cultivated across humid zones.'),
  ('11111111-1111-1111-1111-111111111108', 'Sweet Potato', 'SPOT', 'Root / Tuber', 'kg', 'Orange-fleshed and white varieties.'),
  ('11111111-1111-1111-1111-111111111109', 'Vegetables', 'VEG', 'Horticulture', 'kg', 'Mixed market vegetables including bitterball, okra, and greens.'),
  ('11111111-1111-1111-1111-111111111110', 'Oil Palm', 'PALM', 'Perennial Oil', 'tonnes', 'Smallholder and plantation fresh fruit bunches.')
ON CONFLICT (code) DO NOTHING;

-- Insert Crop Varieties
INSERT INTO public.crop_varieties (crop_id, name, description, maturity_days) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Suakoko 8', 'High-yielding lowland swamp rice variety developed by CARI Liberia.', 125),
  ('11111111-1111-1111-1111-111111111101', 'LAC 23', 'Traditional Liberian upland rice variety renowned for drought tolerance and aroma.', 115),
  ('11111111-1111-1111-1111-111111111101', 'Nerica L-19', 'New Rice for Africa lowland variety with excellent grain quality.', 110),
  ('11111111-1111-1111-1111-111111111102', 'CARICASS 1', 'High-starch disease-resistant cassava variety released by CARI.', 365),
  ('11111111-1111-1111-1111-111111111102', 'TMS 30572', 'Widely adopted elite cassava variety with uniform root sizing.', 330),
  ('11111111-1111-1111-1111-111111111103', 'DMR-ESR-Y', 'Downy mildew resistant early streak yellow maize.', 95),
  ('11111111-1111-1111-1111-111111111104', 'Forastero Hybrid', 'High vigor, disease tolerant cocoa tree.', 1095),
  ('11111111-1111-1111-1111-111111111106', 'Scotch Bonnet', 'Aromatic spicy hot pepper with strong market demand.', 90)
ON CONFLICT DO NOTHING;

-- Insert Quality Templates
-- 1. Rice Template
INSERT INTO public.quality_templates (id, crop_id, template_name, description, version) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'National Rice Quality Standard', 'Inspection template covering moisture, foreign matter, broken grains, and odor.', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.quality_parameters (template_id, parameter_name, description, unit, data_type, min_value, max_value, target_value, weight) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Moisture Content', 'Grains moisture percentage after sun drying or mechanical aeration', '%', 'number', 10.0, 14.0, '12.5', 2.0),
  ('22222222-2222-2222-2222-222222222201', 'Foreign Matter', 'Stones, chaff, dust, and non-rice plant debris percentage', '%', 'number', 0.0, 1.5, '0.5', 1.5),
  ('22222222-2222-2222-2222-222222222201', 'Damaged Grains', 'Insect-bored, chalky, discolored, or mouldy grains', '%', 'number', 0.0, 3.0, '1.0', 1.5),
  ('22222222-2222-2222-2222-222222222201', 'Grain Appearance', 'Visual assessment of color, milling uniformity, and translucency', 'score', 'select', NULL, NULL, 'Good', 1.0),
  ('22222222-2222-2222-2222-222222222201', 'Pest Infestation', 'Presence of live rice weevils, moths, or pest larvae', 'status', 'select', NULL, NULL, 'None', 2.0),
  ('22222222-2222-2222-2222-222222222201', 'Odour Assessment', 'Absence of rancid, musty, or chemical smell', 'status', 'select', NULL, NULL, 'Natural / Clean', 1.0)
ON CONFLICT DO NOTHING;

-- 2. Cassava Template
INSERT INTO public.quality_templates (id, crop_id, template_name, description, version) VALUES
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 'Fresh Cassava Tubers Inspection Standard', 'Freshness, cut wounds, decay, vascular streak, and cleanliness.', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.quality_parameters (template_id, parameter_name, description, unit, data_type, min_value, max_value, target_value, weight) VALUES
  ('22222222-2222-2222-2222-222222222202', 'Freshness Window', 'Hours elapsed since uprooting from soil', 'hours', 'number', 0, 48, '24', 2.0),
  ('22222222-2222-2222-2222-222222222202', 'Physical Damage & Cuts', 'Percentage of roots with broken ends or harvesting gouges', '%', 'number', 0, 5, '2', 1.5),
  ('22222222-2222-2222-2222-222222222202', 'Rot or Internal Decay', 'Tubers showing soft rot, blue streak or discoloration', '%', 'number', 0, 1, '0', 2.0),
  ('22222222-2222-2222-2222-222222222202', 'Size & Condition', 'Tuber diameter uniformity and firmness', 'score', 'select', NULL, NULL, 'Uniform & Firm', 1.0)
ON CONFLICT DO NOTHING;

-- 3. Cocoa Template
INSERT INTO public.quality_templates (id, crop_id, template_name, description, version) VALUES
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111104', 'Export Grade Cocoa Bean Inspection', 'Bean count, fermentation index, moisture, moldy beans, and slate.', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.quality_parameters (template_id, parameter_name, description, unit, data_type, min_value, max_value, target_value, weight) VALUES
  ('22222222-2222-2222-2222-222222222204', 'Moisture Content', 'Moisture percentage of cured cocoa beans', '%', 'number', 6.0, 7.5, '7.0', 2.0),
  ('22222222-2222-2222-2222-222222222204', 'Bean Count per 100g', 'Number of whole beans in a 100g sample weight', 'beans', 'number', 90, 110, '100', 1.5),
  ('22222222-2222-2222-2222-222222222204', 'Fermentation Degree', 'Brown internal cotyledon cut test percentage', '%', 'number', 70, 100, '85', 2.0),
  ('22222222-2222-2222-2222-222222222204', 'Defective & Moldy Beans', 'Beans with insect infestation or internal mold', '%', 'number', 0, 3, '1', 2.0)
ON CONFLICT DO NOTHING;

-- Insert Demo Cooperative
INSERT INTO public.cooperatives (id, name, code, county, district, address, contact_person, contact_phone) VALUES
  ('33333333-3333-3333-3333-333333333301', 'Nimba Farmers Multipurpose Cooperative', 'NFMC-01', 'Nimba', 'Sanniquellie-Mahn', 'Main Market Rd, Sanniquellie', 'Sarah Cooper', '+231-77-512-3401')
ON CONFLICT (code) DO NOTHING;
