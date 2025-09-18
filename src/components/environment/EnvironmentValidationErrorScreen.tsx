import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EnvironmentValidationError } from '../../lib/environmentValidation';
import { EnvironmentValidationModal } from './EnvironmentValidationModal';

export interface EnvironmentValidationErrorScreenProps {
  errors: EnvironmentValidationError[];
  showModal?: boolean;
}

/**
 * Renders a blocking screen plus optional modal whenever required config
 * details are missing, preventing the app from continuing with invalid state.
 */
export const EnvironmentValidationErrorScreen = ({
  errors,
  showModal = true,
}: EnvironmentValidationErrorScreenProps) => {
  const [modalVisible, setModalVisible] = useState(showModal);

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Configuration required</Text>
        <Text style={styles.subtitle}>
          Update your environment variables to continue.
        </Text>
      </View>

      {showModal && (
        <EnvironmentValidationModal
          visible={modalVisible}
          errors={errors}
          onClose={() => setModalVisible(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: '#cbd5f5',
    textAlign: 'center',
  },
});
