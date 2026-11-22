import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewInstance,
  ScrollViewProps,
  StyleSheet,
  TextInput,
} from 'react-native';

interface Props extends ScrollViewProps {
  /** Space kept between the field you are typing in and the top of the keyboard. */
  extraScrollHeight?: number;
}

/**
 * A ScrollView that never lets the keyboard cover the field you are typing in.
 *
 * - while the keyboard is open it adds room at the bottom, so the last field can be scrolled up;
 * - it scrolls the focused field to just above the keyboard, and does so again when you move to
 *   the next field (the keyboard stays open, so no keyboard event fires for that);
 * - taps on buttons still work while the keyboard is open, and dragging the page closes it.
 *
 * Plain JavaScript: it works in Expo Go and does not depend on a native module.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollViewInstance, Props>(function KeyboardAwareScrollView(
  { children, contentContainerStyle, onScroll, extraScrollHeight = 28, ...rest },
  forwardedRef
) {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardTop = useRef<number | null>(null);
  const scrollY = useRef(0);
  const lastFocused = useRef<unknown>(null);

  const setRefs = useCallback(
    (node: ScrollViewInstance | null) => {
      scrollRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  /** Scroll so the focused field ends up above the keyboard. */
  const revealFocusedInput = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput?.() as
      | { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void }
      | null
      | undefined;
    const top = keyboardTop.current;
    if (!input || top == null || !scrollRef.current) return;
    lastFocused.current = input;
    input.measureInWindow((_x, y, _w, h) => {
      const hidden = y + h + extraScrollHeight - top;
      if (hidden > 0) scrollRef.current?.scrollTo({ y: scrollY.current + hidden, animated: true });
    });
  }, [extraScrollHeight]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
      // wait one frame so the extra bottom room is laid out before scrolling into it
      setTimeout(revealFocusedInput, 80);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      lastFocused.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [revealFocusedInput]);

  // Moving from one field to the next keeps the keyboard open, so no keyboard event fires:
  // watch for the focused field changing while the keyboard is up.
  useEffect(() => {
    if (keyboardHeight === 0) return undefined;
    const timer = setInterval(() => {
      const focused = TextInput.State.currentlyFocusedInput?.();
      if (focused && focused !== lastFocused.current) revealFocusedInput();
    }, 250);
    return () => clearInterval(timer);
  }, [keyboardHeight, revealFocusedInput]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  const flat = StyleSheet.flatten(contentContainerStyle) || {};
  const basePadding = typeof flat.paddingBottom === 'number' ? flat.paddingBottom : 0;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      scrollEventThrottle={16}
      {...rest}
      ref={setRefs}
      onScroll={handleScroll}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: basePadding + keyboardHeight }]}
    >
      {children}
    </ScrollView>
  );
});
