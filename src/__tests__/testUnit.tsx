import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import React from 'react'
import BiosignalsPlayback from '../main'
import { BiosignalsPluxPreview } from '../components/BiosignalspluxPreview'
import { BiosignalsPluxView } from '../components/BiosignalspluxView'
import properties from '../properties'

function makeControls() {
  return {
    onPlay: vi.fn().mockReturnValue(() => {}),
    onPause: vi.fn().mockReturnValue(() => {}),
    onSeek: vi.fn().mockReturnValue(() => {}),
    onSync: vi.fn().mockReturnValue(() => {}),
  }
}

function makeContext(filePath = '/test/biosignal.json') {
  return { 
    filePath, 
    captureStartTimestamp: 0, 
    pluginId: 'test',
    fileCaptureStartTimestamp: 0,
    pauseIntervals: []
  }
}

const SAMPLE_DATA = [
  { seq: 0, timestamp: 1000, nSeq: 0, Ch1_EMG: 32768, Ch2_ECG: 32768 },
  { seq: 1, timestamp: 1010, nSeq: 1, Ch1_EMG: 33000, Ch2_ECG: 32500 },
  { seq: 2, timestamp: 1020, nSeq: 2, Ch1_EMG: 31000, Ch2_ECG: 33000 },
  { seq: 3, timestamp: 1030, nSeq: 3, Ch1_EMG: 32900, Ch2_ECG: 32800 },
]

describe('BiosignalsPlayback', () => {
  let plugin: BiosignalsPlayback

  beforeEach(() => {
    plugin = new BiosignalsPlayback()
  })

  it('creates an instance', () => {
    expect(plugin).toBeDefined()
  })

  it('validExtensions returns ["json"]', () => {
    const exts = plugin.validExtensions()
    expect(exts).toContain('json')
    expect(exts).toHaveLength(1)
  })

  it('validateCaptureDescriptor returns true for null', () => {
    expect(plugin.validateCaptureDescriptor(null)).toBe(true)
  })

  it('validateCaptureDescriptor returns true for any object', () => {
    expect(plugin.validateCaptureDescriptor({ type: 'biosignal' })).toBe(true)
    expect(plugin.validateCaptureDescriptor({ random: 'value' })).toBe(true)
    expect(plugin.validateCaptureDescriptor({})).toBe(true)
  })

  it('getView returns JSX element', () => {
    const el = plugin.getView({ controls: makeControls(), context: makeContext(), settings: {} })
    expect(el).not.toBeNull()
  })

  it('getPreview returns JSX element', () => {
    const el = plugin.getPreview()
    expect(el).not.toBeNull()
  })
})

describe('properties', () => {
  it('is defined', () => {
    expect(properties).toBeDefined()
    expect(typeof properties).toBe('object')
  })
})

describe('BiosignalsPluxPreview', () => {
  it('renders without crashing', () => {
    render(<BiosignalsPluxPreview />)
  })

  it('renders a container element', () => {
    const { container } = render(<BiosignalsPluxPreview />)
    expect(container.firstChild).not.toBeNull()
  })

  it('shows BiosignalsPlux heading', () => {
    const { container } = render(<BiosignalsPluxPreview />)
    expect(container.textContent).toContain('BiosignalsPlux')
  })
})

describe('BiosignalsPluxView', () => {
  function renderView(filePath = '/test/biosignal.json') {
    const controls = makeControls()
    const context = makeContext(filePath)
    return {
      ...render(<BiosignalsPluxView controls={controls} context={context} settings={{}} />),
      controls,
    }
  }

  it('renders without crashing', () => {
    renderView()
  })

  it('always renders a select element', () => {
    const { container } = renderView()
    expect(container.querySelector('select')).not.toBeNull()
  })

  it('select has no options when no data loaded', () => {
    const { container } = renderView()
    const select = container.querySelector('select')
    expect(select!.children.length).toBe(0)
  })

  it('registers play handler', () => {
    const { controls } = renderView()
    expect(controls.onPlay).toHaveBeenCalled()
  })

  it('registers pause handler', () => {
    const { controls } = renderView()
    expect(controls.onPause).toHaveBeenCalled()
  })

  it('registers seek handler', () => {
    const { controls } = renderView()
    expect(controls.onSeek).toHaveBeenCalled()
  })

  it('registers sync handler', () => {
    const { controls } = renderView()
    expect(controls.onSync).toHaveBeenCalled()
  })

  it('unsubscribes all handlers on unmount', () => {
    const unsubPlay = vi.fn()
    const unsubPause = vi.fn()
    const unsubSeek = vi.fn()
    const unsubSync = vi.fn()
    const controls = {
      onPlay: vi.fn().mockReturnValue(unsubPlay),
      onPause: vi.fn().mockReturnValue(unsubPause),
      onSeek: vi.fn().mockReturnValue(unsubSeek),
      onSync: vi.fn().mockReturnValue(unsubSync),
    }
    const { unmount } = render(
      <BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />
    )
    unmount()
    expect(unsubPlay).toHaveBeenCalled()
    expect(unsubPause).toHaveBeenCalled()
    expect(unsubSeek).toHaveBeenCalled()
    expect(unsubSync).toHaveBeenCalled()
  })

  it('shows channel selector and data after loading JSON', async () => {
    ;(window.core.fs.readFileSync as any).mockResolvedValueOnce(
      JSON.stringify(SAMPLE_DATA)
    )
    const controls = makeControls()
    const { container } = render(
      <BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />
    )
    await act(async () => { await Promise.resolve() })
    const select = container.querySelector('select')
    expect(select).not.toBeNull()
    expect(select!.children.length).toBeGreaterThan(0)
  })

  it('shows stats table when data loaded', async () => {
    ;(window.core.fs.readFileSync as any).mockResolvedValueOnce(
      JSON.stringify(SAMPLE_DATA)
    )
    const controls = makeControls()
    const { container } = render(
      <BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />
    )
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('export button is disabled when no stats', () => {
    const { container } = renderView()
    const exportBtn = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Exportar'))
    expect(exportBtn).toBeDefined()
    expect(exportBtn!.disabled).toBe(true)
  })

  it('export button is enabled after loading data', async () => {
    ;(window.core.fs.readFileSync as any).mockResolvedValueOnce(
      JSON.stringify(SAMPLE_DATA)
    )
    const controls = makeControls()
    const { container } = render(
      <BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />
    )
    await act(async () => { await Promise.resolve() })
    const exportBtn = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Exportar'))
    expect(exportBtn).toBeDefined()
    expect(exportBtn!.disabled).toBe(false)
  })

  it('zoom buttons fire without crashing', async () => {
    ;(window.core.fs.readFileSync as any).mockResolvedValueOnce(
      JSON.stringify(SAMPLE_DATA)
    )
    const controls = makeControls()
    const { container } = render(
      <BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />
    )
    await act(async () => { await Promise.resolve() })
    const buttons = container.querySelectorAll('button')
    buttons.forEach(btn => { fireEvent.click(btn) })
  })

  it('handles invalid JSON gracefully', async () => {
    ;(window.core.fs.readFileSync as any).mockResolvedValueOnce('not valid json')
    const controls = makeControls()
    render(<BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />)
    await act(async () => { await Promise.resolve() })
  })

  it('play callback does not throw', () => {
    const controls = makeControls()
    let playCallback: (from: number) => void = () => {}
    controls.onPlay.mockImplementation((cb: (from: number) => void) => {
      playCallback = cb
      return () => {}
    })
    render(<BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />)
    act(() => { playCallback(5000) })
  })

  it('seek callback does not throw', () => {
    const controls = makeControls()
    let seekCallback: (to: number) => void = () => {}
    controls.onSeek.mockImplementation((cb: (to: number) => void) => {
      seekCallback = cb
      return () => {}
    })
    render(<BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />)
    act(() => { seekCallback(2000) })
  })

  it('has Analisis heading in the metrics panel', async () => {
    ;(window.core.fs.readFileSync as any).mockResolvedValueOnce(
      JSON.stringify(SAMPLE_DATA)
    )
    const controls = makeControls()
    const { container } = render(
      <BiosignalsPluxView controls={controls} context={makeContext()} settings={{}} />
    )
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('Análisis')
  })
})