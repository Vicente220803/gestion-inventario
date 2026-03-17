1. El plan debe tener una lista de tareas pendientes que puedas ir marcando como completadas a medida que avanzas.
3. Antes de empezar a trabajar, consúltalo conmigo y verificaré el plan.
4. Luego, comienza a trabajar en las tareas pendientes, marcándolas como completadas a medida que avanzas.
5. Por favor, en cada paso del camino, solo dame una explicación de alto nivel de qué cambios hiciste.
6. Haz que cada tarea y cambio de código que realices sea lo más simple posible. Queremos evitar hacer cambios masivos o complejos. Cada cambio debe impactar la menor cantidad de código posible. Todo se trata de simplicidad.
8. NO SEAS PEREZOSO. NUNCA SEAS PEREZOSO. SI HAY UN BUG ENCUENTRA LA CAUSA RAÍZ Y ARRÉGLALO. NO HAGAS ARREGLOS TEMPORALES. ERES UN DESARROLLADOR SENIOR. NUNCA SEAS PEREZOSO.
9. HAZ TODOS LOS ARREGLOS Y CAMBIOS DE CÓDIGO TAN SIMPLES COMO SEA HUMANAMENTE POSIBLE. SOLO DEBEN IMPACTAR EL CÓDIGO NECESARIO RELEVANTE PARA LA TAREA Y NADA MÁS. DEBE IMPACTAR LA MENOR CANTIDAD DE CÓDIGO POSIBLE. TU OBJETIVO ES NO INTRODUCIR BUGS. TODO SE TRATA DE LA SIMPLICIDAD.
10. Esta app está conectada con supabase y la BBDD tienes la estructura en estructura.sql. Cuando hagas un cambio que afecte a la BBDD, cambia también este archivo y pasa script sql solo del cambio para que yo manualmente lo ejecute en SUPABASE.

## n8n Access
- N8N_URL=https://surexportlevante.app.n8n.cloud
- N8N_API_BASE=https://surexportlevante.app.n8n.cloud/api/v1
- N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZjQ0NTdhMC03ZmI2LTQ3OGQtYTUzZi04MTEwNTkzMTM2YWYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczNzU1NDkyfQ.9Zq13b3E3pFboKtFFqbFU8MN_SoxB8rB61Tt7mDEJOE
- Para crear/editar/activar workflows usar: curl -H "X-N8N-API-KEY: $N8N_API_KEY" https://surexportlevante.app.n8n.cloud/api/v1/...