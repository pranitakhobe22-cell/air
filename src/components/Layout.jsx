import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAppStore } from '@/store';
import './Layout.css';

const Layout = () => {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className={`layout ${sidebarCollapsed ? 'layout--collapsed' : ''}`}>
      <Sidebar />
      <div className="layout__main">
        <TopBar />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
