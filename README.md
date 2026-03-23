# Emergency Alert Navigation System (EAS)

A predictive, real-time navigation application designed to optimize emergency vehicle response times by preemptively alerting drivers of approaching ambulances.

## 🚀 Features
- **Predictive Intersection**: Real-time trajectory calculation using Haversine spherical interpolation to detect approaching emergency vehicles.
- **Autonomous Braking Logic**: Automated vehicle velocity modification with a 4-second human reaction delay.
- **3D Vector Maps**: Immersive 3D map perspective with 60-degree tilt and dynamic camera rotation.
- **Live Traffic Events**: Integration with the Longdo Traffic API for real-time accident markers.
- **Custom Ambulance Simulation**: Animated top-down SVG ambulance model with flashing sirens.

## 🛠 Prerequisites
- [Node.js](https://nodejs.org/) (v16.x or later)
- [npm](https://www.npmjs.com/) (v7.x or later)
- A **Google Maps API Key** with the following APIs enabled:
  - Maps JavaScript API
  - Directions API
  - Geometry Library

## ⚙️ Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/waritsanant06/Predictive-Multi-Agent-Navigation-for-Optimized-Emergency-Vehicle-Response.git
   cd "gati web application copy"
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your API credentials:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   VITE_GOOGLE_MAPS_MAP_ID=your_vector_map_id_here
   ```
   *Note: Using a Vector Map ID is required for 3D rotation and tilt functionality.*

4. **Launch Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

## 🧭 How to Run the Simulation
1. Enter an **Origin** and **Destination** in the search panel.
2. Once the route is calculated, click the **"Simulate Drive"** button in the preview panel.
3. Observe as your car navigates the route.
4. After 3 seconds, a mock ambulance will be generated behind you and will proceed to overtake your vehicle. 
5. Watch the automated braking response and navigation HUD updates as the emergency vehicle passes.

## 📄 License
Internal / Research Project
