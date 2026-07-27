import { useApp } from '../context/AppContext'
import { EmeraldSegmented } from '../emerald'

/** Mockup control — flip between the two shell layouts. */
export function LayoutToggle() {
  const { layout, setLayout } = useApp()
  return (
    <div className="layout-toggle" title="Preview shell layout">
      <span className="layout-toggle__label">View</span>
      <EmeraldSegmented
        options={[
          { value: 'sidebar', label: 'Sidebar' },
          { value: 'appheader', label: 'App header' },
        ] as const}
        value={layout}
        onChange={setLayout}
      />
    </div>
  )
}
