# BiosignalsPlux Playback Plugin

A Playback plugin for [**Multimodal Observer**](https://github.com/MultimodalObserver-2/mo), designed to visualize and analyze physiological signal recordings from a biosignalsplux device synchronized with the session timeline.

## Features

- **Signal waveform visualization** synchronized with the session timeline
- **Multi-channel support** — switch between recorded channels (EMG, ECG, EDA, ACC, and more)
- **Seek and pause support** through the session controls
- **Zoom controls** to inspect specific time regions
- **Region selection** by clicking and dragging on the waveform
- **Real-time statistics** — mean, RMS, peak, and CV% for the selected region
- **Export metrics** to a `.txt` file
- **Preview** identifying the plugin in the interface

## Supported Formats

- `.json`

The plugin accepts JSON files produced by the [BiosignalsPlux Capture Plugin](https://github.com/MultimodalObserver-2/mo-plugin-capture-biosignal).

## ⚙️ Configuration Options

This plugin has no configurable properties.

## How It Works

- Reads the JSON recording file and extracts all available signal channels.
- Applies a transfer function to convert raw ADC values to physical units (mV, µS, g).
- Renders the waveform as an SVG polyline that updates as the session plays back.
- Statistics are computed over the visible or selected region and displayed in a side panel.

## 📦 Installation

1. Download the latest plugin release from [here](https://github.com/MultimodalObserver-2/mo-plugin-playback-biosignal/releases/latest).
2. Extract the downloaded `.zip` file.
3. Register the plugin using the plugin interface within Multimodal Observer.
