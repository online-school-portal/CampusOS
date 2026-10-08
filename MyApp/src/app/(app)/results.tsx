import { View, Text, StyleSheet } from 'react-native';

export default function PlaceholderScreen() {
  return (
      <View style={styles.container}>
            <Text style={styles.text}>Coming soon...</Text>
                </View>
                  );
                  }

                  const styles = StyleSheet.create({
                    container: {
                        flex: 1,
                            backgroundColor: '#f1f5f9',
                                justifyContent: 'center',
                                    alignItems: 'center',
                                      },
                                        text: {
                                            fontSize: 18,
                                                color: '#64748b',
                                                  },
                                                  });