import React, { useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

export function SearchFilters({ onFilterChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    montoMin: '',
    montoMax: '',
    ordenar: 'fecha-desc'
  });

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    notifyChange({ ...filters, searchTerm: value });
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    notifyChange({ ...newFilters, searchTerm });
  };

  const notifyChange = (allFilters) => {
    if (onFilterChange) {
      onFilterChange(allFilters);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    const clearedFilters = {
      fechaDesde: '',
      fechaHasta: '',
      montoMin: '',
      montoMax: '',
      ordenar: 'fecha-desc'
    };
    setFilters(clearedFilters);
    notifyChange({ ...clearedFilters, searchTerm: '' });
  };

  const hasActiveFilters = searchTerm || filters.fechaDesde || filters.fechaHasta ||
                          filters.montoMin || filters.montoMax;

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente, RUT o número de cotización..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button
          variant={isOpen ? "default" : "outline"}
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtros
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Panel de filtros avanzados */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50">
          {/* Fecha desde */}
          <div className="space-y-2">
            <Label>Fecha Desde</Label>
            <Input
              type="date"
              value={filters.fechaDesde}
              onChange={(e) => handleFilterChange('fechaDesde', e.target.value)}
            />
          </div>

          {/* Fecha hasta */}
          <div className="space-y-2">
            <Label>Fecha Hasta</Label>
            <Input
              type="date"
              value={filters.fechaHasta}
              onChange={(e) => handleFilterChange('fechaHasta', e.target.value)}
            />
          </div>

          {/* Monto mínimo */}
          <div className="space-y-2">
            <Label>Monto Mínimo</Label>
            <Input
              type="number"
              placeholder="0"
              value={filters.montoMin}
              onChange={(e) => handleFilterChange('montoMin', e.target.value)}
            />
          </div>

          {/* Monto máximo */}
          <div className="space-y-2">
            <Label>Monto Máximo</Label>
            <Input
              type="number"
              placeholder="Sin límite"
              value={filters.montoMax}
              onChange={(e) => handleFilterChange('montoMax', e.target.value)}
            />
          </div>

          {/* Ordenar por */}
          <div className="space-y-2 md:col-span-2 lg:col-span-4">
            <Label>Ordenar por</Label>
            <select
              value={filters.ordenar}
              onChange={(e) => handleFilterChange('ordenar', e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="fecha-desc">Fecha (más reciente primero)</option>
              <option value="fecha-asc">Fecha (más antigua primero)</option>
              <option value="monto-desc">Monto (mayor a menor)</option>
              <option value="monto-asc">Monto (menor a mayor)</option>
              <option value="cliente-asc">Cliente (A-Z)</option>
              <option value="cliente-desc">Cliente (Z-A)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook para aplicar filtros y búsqueda a una lista de cotizaciones
 */
export function useFilteredCotizaciones(cotizaciones, filters) {
  const { searchTerm, fechaDesde, fechaHasta, montoMin, montoMax, ordenar } = filters;

  let filtered = [...cotizaciones];

  // Búsqueda de texto
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(c =>
      (c.cliente?.toLowerCase().includes(term)) ||
      (c.rut?.toLowerCase().includes(term)) ||
      (c.numero?.toLowerCase().includes(term))
    );
  }

  // Filtro por fecha desde
  if (fechaDesde) {
    filtered = filtered.filter(c => c.fecha >= fechaDesde);
  }

  // Filtro por fecha hasta
  if (fechaHasta) {
    filtered = filtered.filter(c => c.fecha <= fechaHasta);
  }

  // Filtro por monto mínimo
  if (montoMin) {
    const min = parseFloat(montoMin);
    filtered = filtered.filter(c => (c.monto || 0) >= min);
  }

  // Filtro por monto máximo
  if (montoMax) {
    const max = parseFloat(montoMax);
    filtered = filtered.filter(c => (c.monto || 0) <= max);
  }

  // Ordenamiento
  filtered.sort((a, b) => {
    switch (ordenar) {
      case 'fecha-desc':
        return (b.fecha || '').localeCompare(a.fecha || '');
      case 'fecha-asc':
        return (a.fecha || '').localeCompare(b.fecha || '');
      case 'monto-desc':
        return (b.monto || 0) - (a.monto || 0);
      case 'monto-asc':
        return (a.monto || 0) - (b.monto || 0);
      case 'cliente-asc':
        return (a.cliente || '').localeCompare(b.cliente || '');
      case 'cliente-desc':
        return (b.cliente || '').localeCompare(a.cliente || '');
      default:
        return 0;
    }
  });

  return filtered;
}
