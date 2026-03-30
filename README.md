<p align="center">
  <img src="https://github.com/Edudev2004/Edudev2004/blob/main/ARBORA-WHITE.png?raw=true" width="100%" alt="Arbora Banner">
</p>

---

Bienvenido a **Arbora**, la solución definitiva para gestionar y visualizar tus flujos de chatbots en WhatsApp y Telegram de manera profesional. Este proyecto es un panel de control moderno, intuitivo y potente diseñado para ofrecer una experiencia de usuario premium con analíticas en tiempo real y un editor de flujos visual.

![Dashboard Preview](https://github.com/Edudev2004/Edudev2004/blob/main/Arbora%20Mockup.png?raw=truew)

## Características Principales

-   **Multi-plataforma**: Integración fluida con **WhatsApp** (vía whatsapp-web.js) y **Telegram**.
-   **Analíticas Avanzadas**: Visualiza métricas clave como mensajes recibidos, usuarios activos y popularidad de nodos mediante gráficos dinámicos (Chart.js).
-   **Interfaz UI/UX Premium**:
    -   Diseño moderno basado en **Glassmorphism** y micro-animaciones.
    -   Soporte completo para **Modo Claro y Oscuro**.
    -   Layout responsivo para cualquier dispositivo.
-   **Editor de Flujos Visual**: Crea y edita la lógica de tu bot mediante un lienzo interactivo basado en **React Flow** (@xyflow/react).
    -   **Auto-distribución**: Organiza tus nodos automáticamente en una estructura de árbol legible con un solo clic.
    -   **Conexiones Inteligentes**: Arrastra y suelta para crear relaciones entre menús, contenidos y respuestas.
    -   **Gestión Arrastrable**: Mueve nodos libremente y utiliza la **zona de basura** dinámica para eliminarlos con facilidad.
    -   **Sincronización Dual**: Edita en el editor visual o en la vista de lista; ambos se mantienen perfectamente sincronizados.

-   **Gestión de Sesiones**: Sistema de autenticación seguro (JWT) y persistencia de datos con **Firebase**.
-   **Vinculación por QR**: Proceso de conexión a WhatsApp simplificado mediante escaneo de código QR directamente en el dashboard.
-   **Tiempo Real**: Notificaciones y actualizaciones de estado instantáneas mediante **Socket.io**.

## Tecnologías Utilizadas

### Frontend
-   **React 19** + **Vite**
-   **@xyflow/react** (React Flow para el editor visual)
-   **Chart.js** & **React-Chartjs-2** (Visualización de datos)
-   **Lucide React** (Iconografía moderna)
-   **CSS Vanilla** (Sistema de diseño personalizado)

### Backend
-   **Node.js** & **Express**
-   **WhatsApp-web.js** & **Node-telegram-bot-api**
-   **Socket.io** (Comunicación bidireccional)
-   **Firebase Admin SDK** (Persistencia y Autenticación)
-   **JSON Web Tokens (JWT)** & **Bcryptjs** (Seguridad)

## Instalación y Configuración

Sigue estos pasos para poner el proyecto en marcha en tu entorno local:

### Requisitos previos
-   Node.js (v18 o superior)
-   Cuenta de Firebase con una clave de cuenta de servicio (`serviceAccountKey.json`).

### 1. Instrucciones de Instalación
```bash
git clone https://github.com/tu-usuario/arbora.git
cd arbora
npm install
```

### 2. Configuración del Proyecto
-   **Backend**: Crea un archivo `.env` en `backend/` con `JWT_SECRET` y coloca el archivo `serviceAccountKey.json` en ese mismo directorio.
-   **Frontend**: Instala dependencias si es necesario (el `npm install` de la raíz debería cubrirlas si usas los scripts de concurrently).

## Ejecución

Para iniciar el proyecto completo (`backend` + `frontend`) en modo desarrollo:

```bash
npm start
```

El dashboard estará disponible en `http://localhost:5173` y se conectará automáticamente al backend en el puerto `3001`.

## Capturas de Pantalla

| Vista de Dashboard | Editor de Flujos | Editor por Nodos |
| :--- | :--- | :--- |
| ![Dashboard](https://github.com/Edudev2004/Edudev2004/blob/main/Arbora-Dashboard.png?raw=true) | ![Flow Editor](https://github.com/Edudev2004/Edudev2004/blob/main/Arbora-HerramientaGrafica.png?raw=true) | ![Node Editor](https://github.com/Edudev2004/Edudev2004/blob/main/Arbora-Nodo.png?raw=true) |

## Privacidad y Seguridad

Al ser un repositorio **privado**, asegúrate de:
-   **No subir nunca** archivos de secretos como `.env` o `serviceAccountKey.json`.
-   Mantener las credenciales de Firebase restringidas a los servicios necesarios.
-   Revisar los permisos de acceso del personal autorizado al repositorio.

---
Desarrollado con ❤️ por [Navarro](https://github.com/Edudev2004)

## Historial de Cambios

Para ver el registro detallado de todas las versiones, consulta el archivo [CHANGELOG.md](./CHANGELOG.md).

