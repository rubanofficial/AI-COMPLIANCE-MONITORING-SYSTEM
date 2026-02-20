import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Outlet } from 'react-router-dom';

const AppShell: React.FC = () => {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#020617' }}>
            <Sidebar />
            <div style={{
                flex: 1,
                marginLeft: '240px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
            }}>
                <TopBar />
                <main style={{
                    flex: 1,
                    padding: '24px',
                    overflowY: 'auto',
                }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppShell;
