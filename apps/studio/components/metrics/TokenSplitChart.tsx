interface TokenSplitProps {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
}

export function TokenSplitChart({
  inputTokens,
  outputTokens,
  inputCost,
  outputCost,
}: TokenSplitProps) {
  const totalTokens = inputTokens + outputTokens;
  const inputPercentage =
    totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0;
  const outputPercentage =
    totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex h-8 rounded-lg overflow-hidden">
        <div
          className="bg-blue-500 flex items-center justify-center text-white text-sm"
          style={{ width: `${inputPercentage}%` }}
        >
          {Math.round(inputPercentage)}%
        </div>
        <div
          className="bg-purple-500 flex items-center justify-center text-white text-sm"
          style={{ width: `${outputPercentage}%` }}
        >
          {Math.round(outputPercentage)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-sm text-gray-600">Context (Input)</div>
          <div className="text-2xl font-bold text-blue-600">
            {inputTokens.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">${inputCost.toFixed(4)}</div>
          <div className="text-xs text-gray-400 mt-1">
            RAG templates + System prompt
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="text-sm text-gray-600">Generation (Output)</div>
          <div className="text-2xl font-bold text-purple-600">
            {outputTokens.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">${outputCost.toFixed(4)}</div>
          <div className="text-xs text-gray-400 mt-1">
            Generated Solidity code
          </div>
        </div>
      </div>
    </div>
  );
}
