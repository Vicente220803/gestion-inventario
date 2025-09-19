import os

# --- Configuración ---
# Directorio raíz del proyecto (donde se ejecuta el script)
ROOT_DIR = '.'

# Nombre del archivo de salida
OUTPUT_FILE = 'codigo_proyecto.txt'

# Archivos y extensiones a incluir (¡importante!)
# Se procesarán los archivos que terminen con estas extensiones.
INCLUDED_EXTENSIONS = (
    '.vue',
    '.js',
    '.css',
    '.html',
    '.json',
    '.md',
    '.config.js' # Para vite.config.js, tailwind.config.js, etc.
)

# Archivos específicos que quieres incluir por su nombre
INCLUDED_FILES = (
    'README.md',
    'package.json',
    '.gitignore',
    'vite.config.js',
    'tailwind.config.js',
    'postcss.config.js'
)

# Directorios a excluir (¡muy importante para el rendimiento!)
# Se ignorarán completamente estas carpetas y su contenido.
EXCLUDED_DIRS = (
    'node_modules',
    '.git',
    'dist',       # Carpeta de build, no es código fuente
    '.vscode'     # Configuración del editor
)

# Archivos específicos a excluir por su nombre
EXCLUDED_FILES = (
    'package-lock.json', # Demasiado largo y no es código fuente principal
    'generar_codigo.py' # Para no incluir el propio script en la salida
)
# --------------------


def should_process(path, is_dir):
    """
    Decide si un archivo o directorio debe ser procesado o ignorado.
    """
    item_name = os.path.basename(path)

    if is_dir:
        return item_name not in EXCLUDED_DIRS

    # Excluir archivos específicos
    if item_name in EXCLUDED_FILES:
        return False
    
    # Incluir archivos específicos por nombre
    if item_name in INCLUDED_FILES:
        return True

    # Incluir por extensión
    return path.endswith(INCLUDED_EXTENSIONS)

def main():
    """
    Función principal que recorre el proyecto y escribe el archivo de salida.
    """
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
            print(f"Generando '{OUTPUT_FILE}'...")
            
            # Recorre el árbol de directorios desde la raíz
            for dirpath, dirnames, filenames in os.walk(ROOT_DIR, topdown=True):
                
                # Modifica la lista de directorios en el lugar para no entrar en los excluidos
                dirnames[:] = [d for d in dirnames if should_process(os.path.join(dirpath, d), True)]

                # Ordena los archivos para un resultado consistente
                filenames.sort()

                for filename in filenames:
                    file_path = os.path.join(dirpath, filename)

                    if should_process(file_path, False):
                        print(f" -> Añadiendo: {file_path}")
                        
                        # Escribe el encabezado del archivo
                        header = f"\n{'='*80}\n--- Archivo: {file_path} ---\n{'='*80}\n\n"
                        outfile.write(header)
                        
                        # Escribe el contenido del archivo
                        try:
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as infile:
                                outfile.write(infile.read())
                        except Exception as e:
                            outfile.write(f"*** No se pudo leer el archivo: {e} ***\n")

        print(f"\n¡Éxito! ✅ Todo el código ha sido guardado en '{OUTPUT_FILE}'.")

    except IOError as e:
        print(f"\nError ❌: No se pudo escribir en el archivo '{OUTPUT_FILE}'. Razón: {e}")

if __name__ == '__main__':
    main()