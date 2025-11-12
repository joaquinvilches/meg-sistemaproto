/**
 * Utilidades para validación y formato de RUT chileno
 */

/**
 * Limpia el RUT dejando solo números y dígito verificador (K)
 * Ejemplo: "12.345.678-9" → "123456789"
 */
export function cleanRUT(rut) {
  if (!rut) return '';
  return rut.toString().replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Calcula el dígito verificador de un RUT
 * @param {string|number} rut - RUT sin dígito verificador
 * @returns {string} Dígito verificador ('0'-'9' o 'K')
 */
export function calculateDV(rut) {
  const cleanedRUT = cleanRUT(rut.toString());
  const rutNumbers = cleanedRUT.replace(/[kK]/g, '');

  let sum = 0;
  let multiplier = 2;

  for (let i = rutNumbers.length - 1; i >= 0; i--) {
    sum += parseInt(rutNumbers[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const dv = 11 - (sum % 11);

  if (dv === 11) return '0';
  if (dv === 10) return 'K';
  return dv.toString();
}

/**
 * Valida si un RUT es válido (formato y dígito verificador)
 * @param {string} rut - RUT completo con o sin formato
 * @returns {boolean} true si el RUT es válido
 */
export function validateRUT(rut) {
  if (!rut || typeof rut !== 'string') return false;

  const cleaned = cleanRUT(rut);

  // Debe tener al menos 2 caracteres (1 número + DV)
  if (cleaned.length < 2) return false;

  // Máximo 9 dígitos + 1 DV = 10 caracteres
  if (cleaned.length > 10) return false;

  // Separar número y dígito verificador
  const rutNumber = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // El número debe ser solo dígitos
  if (!/^\d+$/.test(rutNumber)) return false;

  // Calcular y comparar DV
  const calculatedDV = calculateDV(rutNumber);
  return dv === calculatedDV;
}

/**
 * Formatea un RUT al formato chileno: 12.345.678-9
 * @param {string} rut - RUT sin formato o con formato parcial
 * @returns {string} RUT formateado
 */
export function formatRUT(rut) {
  if (!rut) return '';

  const cleaned = cleanRUT(rut);
  if (cleaned.length < 2) return cleaned;

  const rutNumber = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Agregar puntos cada 3 dígitos desde atrás
  let formatted = '';
  for (let i = rutNumber.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = rutNumber[i] + formatted;
  }

  return `${formatted}-${dv}`;
}

/**
 * Formatea RUT mientras el usuario escribe (auto-formato)
 * @param {string} value - Valor actual del input
 * @param {string} previousValue - Valor anterior del input
 * @returns {string} RUT formateado
 */
export function autoFormatRUT(value, previousValue = '') {
  if (!value) return '';

  const cleaned = cleanRUT(value);

  // Si está borrando, permitir borrar libremente
  if (cleaned.length < cleanRUT(previousValue).length) {
    return formatRUT(cleaned);
  }

  // Auto-formatear mientras escribe
  return formatRUT(cleaned);
}

/**
 * Hook personalizado para input de RUT con validación y formato automático
 * Usar en componentes React
 */
export function useRUTInput(initialValue = '') {
  const [value, setValue] = React.useState(formatRUT(initialValue));
  const [isValid, setIsValid] = React.useState(validateRUT(initialValue));
  const [error, setError] = React.useState('');

  const onChange = (newValue) => {
    const formatted = autoFormatRUT(newValue, value);
    setValue(formatted);

    const cleaned = cleanRUT(formatted);
    if (cleaned.length === 0) {
      setIsValid(false);
      setError('');
    } else if (cleaned.length >= 2) {
      const valid = validateRUT(formatted);
      setIsValid(valid);
      setError(valid ? '' : 'RUT inválido');
    } else {
      setIsValid(false);
      setError('');
    }
  };

  return {
    value,
    onChange,
    isValid,
    error,
    cleanValue: cleanRUT(value)
  };
}
