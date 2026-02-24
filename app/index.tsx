import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [checked, setChecked]               = useState(false);
  const [walkthroughSeen, setWalkthroughSeen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('walkthrough_seen')
      .then((val) => {
        setWalkthroughSeen(val === 'true');
        setChecked(true);
      })
      .catch(() => {
        // If AsyncStorage fails, skip walkthrough to avoid blocking user
        setWalkthroughSeen(true);
        setChecked(true);
      });
  }, []);

  if (!checked) return null;

  return <Redirect href={walkthroughSeen ? '/welcome' : '/walkthrough'} />;
}
