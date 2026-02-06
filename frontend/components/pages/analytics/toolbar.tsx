import React from 'react';

export const AnalyticsToolbar: React.FC = () => {
  const timeRanges = ['1H', '24H', '7D', '30D'];
  const [selectedRange, setSelectedRange] = React.useState('24H');

  return (
    <div className="hidden md:flex bg-white/[0.03] p-0.5 rounded-lg border border-white/5">
      {timeRanges.map((range) => (
        <button
          key={range}
          onClick={() => setSelectedRange(range)}
          className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
            selectedRange === range
              ? 'text-white bg-white/10 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
};