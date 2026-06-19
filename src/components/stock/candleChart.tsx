'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, HistogramSeries } from 'lightweight-charts';

interface CandleChartProps {
  data: {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

export default function CandleChart({ data }: CandleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa', // zinc-400
        fontSize: 10,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      grid: {
        vertLines: { color: 'rgba(39, 39, 42, 0.3)' }, // zinc-800
        horzLines: { color: 'rgba(39, 39, 42, 0.3)' }
      },
      crosshair: {
        mode: 1, // Magnet mode
        vertLine: {
          color: '#06b6d4', // Cyan
          width: 1,
          style: 3, // dashed
          labelBackgroundColor: '#0891b2'
        },
        horzLine: {
          color: '#06b6d4',
          width: 1,
          style: 3,
          labelBackgroundColor: '#0891b2'
        }
      },
      rightPriceScale: {
        borderColor: '#18181b', // zinc-900
        autoScale: true,
      },
      timeScale: {
        borderColor: '#18181b',
        timeVisible: true,
        secondsVisible: false,
      }
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // emerald-500
      downColor: '#f43f5e', // rose-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Add Volume Series as Histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay pane
    });
    volumeSeriesRef.current = volumeSeries;

    // Configure Volume Scale Placement
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // volume takes up bottom 20%
        bottom: 0,
      },
    });

    // Handle Window Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // Initial resize trigger
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data when data prop changes
  useEffect(() => {
    if (candlestickSeriesRef.current && volumeSeriesRef.current && data && data.length > 0) {
      // Map candlestick data
      const candleData = data.map(item => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close
      }));

      // Map volume data with color coding based on close vs open
      const volData = data.map(item => ({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'
      }));

      candlestickSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volData);

      // Fit content
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div className="relative w-full h-full min-h-[350px]">
      <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
