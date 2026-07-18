'use client';

/**
 * "Descargar PDF" = imprimir con el diálogo del navegador y elegir "Guardar
 * como PDF" -sin librerías nuevas que mantener-. print:hidden se encarga de
 * que el propio botón desaparezca del documento resultante.
 */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary print:hidden">
      Descargar PDF
    </button>
  );
}
