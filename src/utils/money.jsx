/**
 * Utilidades para formateo de montos (CLP)
 * Formato chileno: separador de miles con punto (.)
 * Ejemplo: 5.000.000
 */

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

// Formateadores Intl
export const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

export const CLP_INT = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0
});

/**
 * Formatea un número como moneda CLP
 * @param {number} n - Número a formatear
 * @returns {string} - Ej: "$5.000.000"
 */
export const fmtMoney = (n) => CLP.format(Math.round(n || 0));

/**
 * Formatea un número con separadores de miles (sin símbolo de moneda)
 * @param {number} n - Número a formatear
 * @returns {string} - Ej: "5.000.000"
 */
export const fmtNumber = (n) => CLP_INT.format(Math.round(n || 0));

/**
 * Remueve todo excepto dígitos de un string
 * @param {string} s - String a limpiar
 * @returns {string} - Solo dígitos
 */
export const onlyDigits = (s = "") => s.replace(/\D+/g, "");

/**
 * Convierte un string a número entero
 * @param {string} s - String a convertir
 * @returns {number} - Número entero
 */
export const toInt = (s = "") => {
  const d = onlyDigits(s);
  return d ? parseInt(d, 10) : 0;
};

/**
 * MoneyInput - Input con formateo automático de montos
 *
 * Muestra valores con separadores de miles mientras se escribe (ej: 5.000.000)
 * pero entrega números limpios al componente padre
 *
 * @param {number} valueNumber - Valor numérico actual
 * @param {function} onValueNumberChange - Callback que recibe el número limpio
 * @param {string} placeholder - Placeholder del input
 * @param {object} props - Props adicionales para el Input
 *
 * @example
 * <MoneyInput
 *   valueNumber={precio}
 *   onValueNumberChange={(num) => setPrecio(num)}
 *   placeholder="Ingrese monto"
 * />
 */
export function MoneyInput({
  valueNumber = 0,
  onValueNumberChange,
  placeholder,
  ...props
}) {
  const [text, setText] = useState(
    valueNumber ? CLP_INT.format(Math.round(valueNumber)) : ""
  );

  // Si el valor externo cambia, sincroniza el texto
  useEffect(() => {
    const cur = toInt(text);
    if ((valueNumber || 0) !== cur) {
      setText(valueNumber ? CLP_INT.format(Math.round(valueNumber)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueNumber]);

  const handleChange = (e) => {
    const raw = e.target.value ?? "";
    const num = toInt(raw);
    setText(raw === "" ? "" : CLP_INT.format(num));
    onValueNumberChange?.(num);
  };

  const handleBlur = () => {
    const num = toInt(text);
    setText(num ? CLP_INT.format(num) : "");
  };

  const handleFocus = (e) => e.target.select();

  return (
    <Input
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder ?? "0"}
      {...props}
    />
  );
}
