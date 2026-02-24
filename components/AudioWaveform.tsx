import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

const BAR_COUNT = 24;
const BAR_WIDTH = 4;
const BAR_GAP = 3;
const MAX_HEIGHT = 60;
const MIN_HEIGHT = 6;

interface WaveBarProps {
  index: number;
  isRecording: boolean;
  color?: string;
}

function WaveBar({ index, isRecording, color = Colors.celestialGold }: WaveBarProps) {
  const height = useSharedValue(MIN_HEIGHT);

  useEffect(() => {
    if (isRecording) {
      const targetHeight = Math.random() * (MAX_HEIGHT - MIN_HEIGHT) + MIN_HEIGHT;
      height.value = withDelay(
        index * 50,
        withRepeat(
          withTiming(targetHeight, {
            duration: Math.random() * 300 + 200,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true
        )
      );
    } else {
      height.value = withTiming(MIN_HEIGHT, { duration: 400 });
    }
    // height/index/star props are stable (memoized) – safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        animStyle,
        {
          width: BAR_WIDTH,
          backgroundColor: color,
          marginHorizontal: BAR_GAP / 2,
        },
      ]}
    />
  );
}

interface AudioWaveformProps {
  isRecording: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function AudioWaveform({ isRecording, color, size = 'md' }: AudioWaveformProps) {
  const barCount = size === 'sm' ? 12 : size === 'lg' ? 32 : BAR_COUNT;

  return (
    <View style={styles.container}>
      {Array.from({ length: barCount }, (_, i) => (
        <WaveBar key={i} index={i} isRecording={isRecording} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MAX_HEIGHT + 20,
  },
  bar: {
    borderRadius: 3,
  },
});
