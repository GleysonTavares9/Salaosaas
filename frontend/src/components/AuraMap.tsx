
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Salon } from '../types';

interface AuraMapProps {
    center: [number, number];
    zoom?: number;
    markers: Array<{
        id: string;
        position: [number, number];
        icon: L.DivIcon;
        popup?: React.ReactNode;
        onClick?: () => void;
    }>;
    userMarker?: {
        position: [number, number];
        icon: L.DivIcon;
        popupContent?: string;
    };
    clusterIconFactory?: (cluster: any) => L.DivIcon;
    className?: string;
}

const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng], map.getZoom());
    }, [lat, lng, map]);
    return null;
};

const AuraMap: React.FC<AuraMapProps> = ({
    center,
    zoom = 13,
    markers,
    userMarker,
    clusterIconFactory,
    className = "h-full w-full"
}) => {
    return (
        <MapContainer
            center={center}
            zoom={zoom}
            zoomControl={false}
            attributionControl={false}
            style={{ height: '100%', width: '100%', background: '#0c0d10' }}
            className={className}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <RecenterMap lat={center[0]} lng={center[1]} />

            {userMarker && (
                <Marker position={userMarker.position} icon={userMarker.icon}>
                    {userMarker.popupContent && (
                        <Popup className="custom-popup">
                            <div className="px-4 py-2 font-black text-[10px] uppercase tracking-widest text-primary">
                                {userMarker.popupContent}
                            </div>
                        </Popup>
                    )}
                </Marker>
            )}

            <MarkerClusterGroup
                chunkedLoading
                iconCreateFunction={clusterIconFactory}
                maxClusterRadius={40}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
            >
                {markers.map((m) => (
                    <Marker
                        key={m.id}
                        position={m.position}
                        icon={m.icon}
                        eventHandlers={m.onClick ? { click: m.onClick } : undefined}
                    >
                        {m.popup}
                    </Marker>
                ))}
            </MarkerClusterGroup>
        </MapContainer>
    );
};

export default AuraMap;
