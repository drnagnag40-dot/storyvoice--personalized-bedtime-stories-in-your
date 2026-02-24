import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function SingleStar({ star }: { star: Star }) {
  const opacity = useSharedValue(Math.random() * 0.4 + 0.1);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withTiming(Math.random() * 0.5 + 0.5, {
          duration: star.duration,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      )
    );
    // opacity is a stable Reanimated shared value; star props are memoized – safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        style,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
        },
      ]}
    />
  );
}

interface StarFieldProps {
  count?: number;
  colors?: string[];
}

export default function StarField({ count = 80, colors = ['#FFFFFF', '#FFD700', '#E8E8FF'] }: StarFieldProps) {
  const stars = useMemo<Star[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 2.5 + 0.8,
      delay: Math.random() * 3000,
      duration: Math.random() * 2000 + 1500,
    })),
    [count]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star) => (
        <SingleStar key={star.id} star={star} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});
