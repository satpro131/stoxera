'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, LineSeries } from 'lightweight-charts';

interface PatternChartProps {
  data: {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  patternLines?: {
    upper: { time: string; value: number }[];
    lower: { time: string; value: number }[];
  } | null;
}

export default function PatternChart({ data, patternLines }: PatternChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const upperLineSeriesRef = useRef<any>(null);
  const lowerLineSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
        fontSize: 10,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      grid: {
        vertLines: { color: 'rgba(39, 39, 42, 0.15)' },
        horzLines: { color: 'rgba(39, 39, 42, 0.15)' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#eab308', width: 1, style: 3 },
        horzLine: { color: '#eab308', width: 1, style: 3 }
      },
      rightPriceScale: {
        borderColor: '#18181b',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#18181b',
        timeVisible: true,
      }
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Add Upper Trendline Series (Dashed Yellow)
    const upperLineSeries = chart.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });
    upperLineSeriesRef.current = upperLineSeries;

    // Add Lower Trendline Series (Dashed Yellow)
    const lowerLineSeries = chart.addSeries(LineSeries, {
      color: '#06b6d4', // Cyan for lower or Yellow
      lineWidth: 2,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });
    lowerLineSeriesRef.current = lowerLineSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data and trendlines
  useEffect(() => {
    if (candlestickSeriesRef.current && data.length > 0) {
      // Set Candlestick data
      const candleData = data.map(item => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close
      }));
      candlestickSeriesRef.current.setData(candleData);

      // Set Upper Line data
      if (patternLines?.upper && upperLineSeriesRef.current) {
        upperLineSeriesRef.current.setData(patternLines.upper);
      } else if (upperLineSeriesRef.current) {
        upperLineSeriesRef.current.setData([]);
      }

      // Set Lower Line data
      if (patternLines?.lower && lowerLineSeriesRef.current) {
        lowerLineSeriesRef.current.setData(patternLines.lower);
      } else if (lowerLineSeriesRef.current) {
        lowerLineSeriesRef.current.setData([]);
      }

      // Fit scale
      chartRef.current?.timeScale().fitContent();
    }
  }, [data, patternLines]);

  return (
    <div className="relative w-full h-full min-h-[280px]">
      <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
