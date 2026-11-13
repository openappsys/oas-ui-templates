// Type definitions for MapLibre
declare global {
  interface Window {
    maplibregl: any;
  }
}

import type { CountrySales } from '../data/screen'

// MapLibre initialization and update functions
export function initMap(container: HTMLElement, countries: CountrySales[]): () => void {
  let map: any = null
  let labelsContainer: HTMLElement | null = null
  
  // Find min and max values for color interpolation
  const values = countries.map(c => c.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  
  try {
    // Initialize MapLibre map
    map = new window.maplibregl.Map({
      container,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [0, 20],
      zoom: 1.5,
      interactive: false,
      attributionControl: false,
      antialias: true,
    })
    
    // Add GeoJSON source and layer
    map.on('load', () => {
      if (!map) return
      
      map.addSource('world', {
        type: 'geojson',
        data: '/world.geojson'
      })
      
      // Add the world countries layer with color based on value
      map.addLayer({
        id: 'world-fill',
        type: 'fill',
        source: 'world',
        layout: {},
        paint: {
          'fill-color': [
            'case',
            ['has', 'value'],
            ['interpolate', ['linear'], ['get', 'value'], minValue, '#1e3a5f', maxValue, '#00d4ff'],
            '#16213e'
          ],
          'fill-opacity': 0.8
        }
      })
      
      // Add labels overlay
      createLabelsOverlay(container, countries)
    })
    
    // Handle map errors gracefully
    map.on('error', () => {
      // Fallback to HTML labels if WebGL fails
      createLabelsOverlay(container, countries)
    })
    
  } catch (_e) {
    // If MapLibre fails to initialize, fallback to HTML labels
    console.warn('MapLibre failed to initialize, using HTML label overlay only')
    createLabelsOverlay(container, countries)
  }
  
  function createLabelsOverlay(container: HTMLElement, countries: CountrySales[]) {
    // Remove any existing labels container
    if (labelsContainer) {
      labelsContainer.remove()
    }
    
    // Create labels container
    labelsContainer = document.createElement('div')
    labelsContainer.className = 'map-labels'
    container.appendChild(labelsContainer)
    
    // Add label for each country
    countries.forEach(country => {
      const label = document.createElement('div')
      label.className = 'map-label'
      label.setAttribute('data-country', country.key)
      label.textContent = `${country.name} ${Math.round(country.value / 1000)}k`
      
      // Use equirectangular projection for fallback
      const containerRect = container.getBoundingClientRect()
      const x = ((country.lng + 180) / 360) * containerRect.width
      const y = ((85 - country.lat) / 170) * containerRect.height
      
      label.style.position = 'absolute'
      label.style.left = `${x}px`
      label.style.top = `${y}px`
      label.style.transform = 'translate(-50%, -50%)'
      label.style.pointerEvents = 'none'
      
      labelsContainer!.appendChild(label)
    })
  }
  
  // Return cleanup function
  return () => {
    if (map) {
      map.remove()
    }
    if (labelsContainer) {
      labelsContainer.remove()
    }
  }
}

export function updateMapLabels(container: HTMLElement, countries: CountrySales[]) {
  const labelsContainer = container.querySelector<HTMLElement>('.map-labels')
  if (!labelsContainer) return
  
  // Remove existing labels
  while (labelsContainer.firstChild) {
    labelsContainer.removeChild(labelsContainer.firstChild)
  }
  
  // Add updated labels
  countries.forEach(country => {
    const label = document.createElement('div')
    label.className = 'map-label'
    label.setAttribute('data-country', country.key)
    label.textContent = `${country.name} ${Math.round(country.value / 1000)}k`
    
    // Use equirectangular projection for fallback
    const containerRect = container.getBoundingClientRect()
    const x = ((country.lng + 180) / 360) * containerRect.width
    const y = ((85 - country.lat) / 170) * containerRect.height
    
    label.style.position = 'absolute'
    label.style.left = `${x}px`
    label.style.top = `${y}px`
    label.style.transform = 'translate(-50%, -50%)'
    label.style.pointerEvents = 'none'
    
    labelsContainer.appendChild(label)
  })
}