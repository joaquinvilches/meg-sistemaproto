import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { autoFormatRUT, validateRUT, cleanRUT } from '../utils/rut';
import { CheckCircle, XCircle } from 'lucide-react';

export function RUTInput({
  label = "RUT",
  value = '',
  onChange,
  placeholder = "12.345.678-9",
  required = false,
  className = "",
  disabled = false
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isValid, setIsValid] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  // Sincronizar con valor externo
  useEffect(() => {
    setDisplayValue(value);
    if (value) {
      setIsValid(validateRUT(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    const formatted = autoFormatRUT(newValue, displayValue);

    setDisplayValue(formatted);
    setIsTouched(true);

    const cleaned = cleanRUT(formatted);
    const valid = cleaned.length >= 2 && validateRUT(formatted);
    setIsValid(valid);

    // Notificar al padre
    if (onChange) {
      onChange(formatted);
    }
  };

  const handleBlur = () => {
    setIsTouched(true);
  };

  const showValidation = isTouched && displayValue.length > 0;
  const showError = showValidation && !isValid && cleanRUT(displayValue).length >= 2;
  const showSuccess = showValidation && isValid;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor="rut-input">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          id="rut-input"
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${
            showError ? 'border-red-500 focus:ring-red-500' : ''
          } ${
            showSuccess ? 'border-green-500 focus:ring-green-500' : ''
          }`}
        />

        {showValidation && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : cleanRUT(displayValue).length >= 2 ? (
              <XCircle className="w-5 h-5 text-red-500" />
            ) : null}
          </div>
        )}
      </div>

      {showError && (
        <p className="text-sm text-red-500">
          RUT inválido. Verifica el dígito verificador.
        </p>
      )}

      {showSuccess && (
        <p className="text-sm text-green-600">
          RUT válido
        </p>
      )}
    </div>
  );
}
