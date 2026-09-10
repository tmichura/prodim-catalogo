"""
Genera src/data/productos.json a partir de los CSV que estén en
data-source/csv/. Lo corre automáticamente el workflow de GitHub Actions
"actualizar-productos.yml" cada vez que se sube/cambia un CSV en esa
carpeta, pero también se puede correr a mano:

    python scripts/generar_productos.py

Misma lógica de parseo que el script que corría Tobias en su PC
(formateo de precios, detección de categorías por fila, columna de
dilución opcional) — solo cambian las rutas de entrada/salida y se
saca la pausa interactiva al final para que funcione en CI.
"""

import pandas as pd
import json
import re
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_DIR = os.path.join(REPO_ROOT, "data-source", "csv")
OUTPUT_PATH = os.path.join(REPO_ROOT, "src", "data", "productos.json")


def leer_csv_robusto(ruta):
    for encoding in ["utf-8-sig", "latin1", "cp1252"]:
        try:
            return pd.read_csv(ruta, sep=None, engine="python", encoding=encoding)
        except Exception:
            continue
    return None


def formatear_oferta(texto):
    if pd.isna(texto) or str(texto).strip() == "":
        return ""
    t = str(texto).replace("\n", " ").strip()

    match = re.search(r"(?:x\s?)?(\d+[\d,.]*)?\s?(KG|LT|UN|un)\s?\$?\s?([\d,.]+)", t, re.IGNORECASE)

    if match:
        cant_raw = match.group(1)
        uni_raw = match.group(2).lower()
        precio_raw = match.group(3).strip()

        if cant_raw:
            c_limpia = cant_raw.replace(",", ".")
            try:
                val = float(c_limpia)
                cant = str(int(val)) if val.is_integer() else str(val)
            except Exception:
                cant = cant_raw.strip()
        else:
            cant = "1"

        p_normalizado = precio_raw.replace(",", ".")
        try:
            precio = str(int(float(p_normalizado)))
        except Exception:
            precio = re.sub(r"[,.].*", "", precio_raw)

        uni_map = {"un": "u", "kg": "kg", "lt": "lt"}
        uni = uni_map.get(uni_raw, uni_raw)
        uni_mayus = uni.upper()

        if cant == "1":
            return f"{uni_mayus} x ${precio} c/{uni}"
        return f"{cant}{uni_mayus} x ${precio} c/{uni}"

    return t


def formatear_dilucion(valor):
    """Se deja tal cual viene del CSV; vacío si el producto no se diluye."""
    if pd.isna(valor):
        return ""
    return str(valor).strip()


def procesar():
    # Este script corre en CADA push a main (no solo cuando cambia el CSV),
    # así que la ausencia de CSV es un estado normal, no un error: no hay
    # nada para regenerar y el deploy debe seguir con el productos.json
    # que ya está en el repo.
    if not os.path.isdir(CSV_DIR):
        print(f"No existe la carpeta {CSV_DIR}, no se tocó productos.json.")
        return

    archivos_csv = [f for f in os.listdir(CSV_DIR) if f.lower().endswith(".csv")]
    if not archivos_csv:
        print(f"Todavía no hay ningún CSV en {CSV_DIR}, no se tocó productos.json.")
        return

    dataframes = []
    for archivo in archivos_csv:
        df_temp = leer_csv_robusto(os.path.join(CSV_DIR, archivo))
        if df_temp is None:
            print(f"AVISO: no se pudo leer {archivo}, se lo salteó.")
            continue

        df_temp = df_temp.rename(columns={"N O M B R E": "NOMBRE"})

        cols = list(df_temp.columns)
        precio_cols = [c for c in cols if c not in ("CODIGO", "NOMBRE") and not str(c).upper().startswith("DILUC")]
        rename_precios = {c: f"PRECIO{i+1}" for i, c in enumerate(precio_cols[:3])}
        df_temp = df_temp.rename(columns=rename_precios)

        diluc_cols = [c for c in cols if str(c).upper().startswith("DILUC")]
        diluc_col = diluc_cols[0] if diluc_cols else None

        categoria_actual = "GENERAL"
        productos_con_cat = []

        for _, row in df_temp.iterrows():
            nombre = str(row.get("NOMBRE", "")).strip()
            codigo = str(row.get("CODIGO", "")).strip()

            if nombre == "" or nombre.lower() == "nan":
                continue

            if codigo == "" or "nan" in codigo.lower():
                if "*" in nombre or (nombre.isupper() and len(nombre) > 2):
                    categoria_actual = nombre
                    continue

            codigo_limpio = codigo.replace(".0", "")
            if codigo_limpio.isdigit():
                row_dict = {
                    "CODIGO": int(float(codigo)),
                    "NOMBRE": nombre,
                    "CATEGORIA": categoria_actual,
                    "PRECIO1": formatear_oferta(row.get("PRECIO1", "")),
                    "PRECIO2": formatear_oferta(row.get("PRECIO2", "")),
                    "PRECIO3": formatear_oferta(row.get("PRECIO3", "")),
                    "DILUCION": formatear_dilucion(row.get(diluc_col, "")) if diluc_col else "",
                }
                productos_con_cat.append(row_dict)

        if productos_con_cat:
            dataframes.append(pd.DataFrame(productos_con_cat))

    if not dataframes:
        print("No se encontraron productos válidos para procesar. No se tocó productos.json.")
        sys.exit(1)

    df_final = pd.concat(dataframes, ignore_index=True).drop_duplicates(subset=["CODIGO"], keep="last")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(df_final.to_dict(orient="records"), f, ensure_ascii=False, indent=4)

    print(f"Listo: {len(df_final)} productos escritos en {OUTPUT_PATH}")


if __name__ == "__main__":
    procesar()
