import React from 'react';

interface ComputingMetricsProps {
  isActive: boolean;
  thinkingStep: string;
}

export function ComputingMetrics({ isActive, thinkingStep }: ComputingMetricsProps) {
  if (!isActive || !thinkingStep) return null;

  return (
    <div className="text-gray-500 text-sm italic mt-2">
      {thinkingStep}
    </div>
  );
}