\<div align="center"\>

# Torrent Streaming Platform

A modern, web-based platform for streaming video content directly from torrents, inspired by services like Stremio.

\</div\>

## ⚠️ Project Status

This project is currently a **work in progress**. The frontend is significantly developed, demonstrating the core user interface and experience. Key backend services, such as user authentication and watchlist management, are in the final stages of completion.

Demo: https://torrent-platform.netlify.app/home 

## Core Features

  * **On-the-Fly Streaming**: Leverages a powerful backend to stream video content directly from magnet links without requiring a full download.
  * **Addon-Powered Metadata**: Integrates with Stremio addons (e.g., Cinemeta) to automatically fetch rich metadata, posters, and descriptions for movies and series.
  * **Advanced Torrent Search**: The backend uses Jackett to aggregate search results from various torrent indexers, providing a wide range of sources.
  * **Modern User Interface**: A responsive, single-page application built with React, featuring a discover page, detailed item views, and a custom media player.
  * **User Accounts & Watchlists**: Includes the UI for user registration, login, and creating custom "Lists" (folders) to organize content. The backend functionality for this is under development.
  * **Customizable Appearance**: Users can modify the application's theme (Light/Dark), accent colors, and list icons through the settings panel.

## ⚙️ Platform Architecture

The platform operates with a decoupled architecture, ensuring security and efficiency. All torrent-related activity is handled by the backend, which is designed to run within a **VPN** to ensure user privacy.

1.  **Frontend (Client)**: A React application where users browse content, manage their accounts, and initiate a stream.
2.  **Backend (Node.js/Express)**: A secure API that acts as an intermediary.
      * **Search**: Receives search queries from the frontend and uses a **Jackett** instance to find torrents across multiple indexers.
      * **Streaming**: When a user selects a torrent, the backend passes the magnet link to **Peerflix** (or a similar torrent streaming engine).
      * **Transcoding**: If the video file is in an unsupported format (e.g., `.mkv`), the backend performs **on-the-fly transcoding** to a web-compatible format like `.mp4` before streaming it to the user.
      * **Privacy**: All torrent-related traffic (searching, downloading, seeding) is handled by the backend and is designed to be routed through a VPN, completely obscuring the end-user's activity.

## 🚧 Current Status & Roadmap

While the frontend is substantially built, several areas are actively being developed or require refinement.

### Backend Development

The backend services are in the final stages of implementation. This includes:

  - Finalizing the user authentication (Login/Sign-up) and session management flow.
  - Implementing the database logic for creating, updating, and deleting user watchlists.
  - Completing the API endpoints for all account and watchlist functionalities.

### UI & Styling

Certain areas of the UI require styling adjustments and fixes to ensure a polished and fully responsive experience:

  - **Content View**: The display of items within a watchlist folder needs refinement.
  - **Media Player**: The custom media player requires further styling to improve its look and feel.
  - **Mobile Responsiveness**: While the app is partially responsive, components like the **Navbar** need modifications to ensure they function and display correctly on smaller mobile screens.

## 🛠️ Tech Stack

### Frontend

  * **Framework**: [React](https://reactjs.org/)
  * **Build Tool**: [Create React App](https://www.google.com/search?q=https://create-react-app.dev/) with [Craco](https://craco.js.org/)
  * **Routing**: [React Router](https://reactrouter.com/)
  * **Styling**: CSS with CSS Variables
  * **Icons**: [Lucide React](https://lucide.dev/), [React Icons](https://react-icons.github.io/react-icons/)
  * **Drag & Drop**: [dnd-kit](https://dndkit.com/)
  * **Addon Client**: `stremio-addon-client`

### Backend

  * **Framework**: [Express.js](https://expressjs.com/)
  * **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/)
  * **Torrent Search**: [Jackett](https://github.com/Jackett/Jackett)
  * **Torrent Streaming**: [Peerflix](https://github.com/mafintosh/peerflix) 

## 🚀 Getting Started

To get this project up and running on your local machine, follow these steps.

### Prerequisites

  * [Node.js](https://nodejs.org/) (v14 or later)
  * `npm` or `yarn` package manager
  * A running instance of the **backend server**.
  * Running instances of **Jackett** and **Peerflix**, accessible by the backend.
  * (Recommended) A **VPN** configured on the machine running the backend services.

### Backend Setup

1.  Use the code in `temp.js` as a guide to create a Node.js application.
2.  Install dependencies: `npm install express jsonwebtoken bcryptjs node-fetch`.
3.  Create a `.env` file and populate it with your service URLs and API keys:
    ```env
    # A strong, secret key for signing JWTs
    JWT_SECRET=your_super_secret_jwt_key

    # URL and API key for your Jackett instance
    JACKETT_URL=http://your-jackett-ip:9117
    JACKETT_API_KEY=your_jackett_api_key

    # URL for your streaming service (e.g., Stremio Service/Peerflix wrapper)
    STREMIO_URL=http://your-streaming-service-ip:11470
    ```
4.  Run the backend server, ensuring it is properly configured to run within your VPN.

### Frontend Setup

1.  **Clone the repository:**

    ```sh
    git clone https://github.com/August-B-F/torrent-video-platform
    cd torrent-video-platform
    ```

2.  **Install dependencies:**

    ```sh
    npm install
    ```

3.  **Run the development server:**

    ```sh
    npm start
    ```

    This will open the application at [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000).

## 📜 Available Scripts

### `npm start`

Runs the app in development mode with live reloading.

### `npm run build`

Builds the app for production to the `build` folder.