import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import {
  DatabaseOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { Dropdown, theme, Spin } from 'antd';
import type { MenuProps } from 'antd';
import * as api from '../api';
import { getToken, removeToken } from '../utils/auth';

const menuRoutes = {
  routes: [
    {
      path: '/',
      name: '知识库',
      icon: <DatabaseOutlined />,
    },
    {
      path: '/graph',
      name: '知识图谱',
      icon: <ApartmentOutlined />,
    },
    {
      path: '/manage',
      name: '管理',
      icon: <SettingOutlined />,
    },
  ],
};

export default function BasicLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(true);
  const { token } = theme.useToken();

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true });
      return;
    }
    api.getMe()
      .then((user) => {
        setUsername(user.username);
      })
      .catch(() => {
        removeToken();
        navigate('/login', { replace: true });
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleLogout = () => {
    removeToken();
    navigate('/login', { replace: true });
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'settings', icon: <SettingOutlined />, label: '个人设置' },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ProLayout
      title="CIFT"
      logo={
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #1677ff, #4096ff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          C
        </div>
      }
      layout="mix"
      fixSiderbar
      collapsed={collapsed}
      onCollapse={setCollapsed}
      route={menuRoutes}
      location={{ pathname: location.pathname }}
      token={{
        header: {
          colorBgHeader: '#001529',
          colorHeaderTitle: '#fff',
          colorTextMenu: 'rgba(255,255,255,0.65)',
          colorTextMenuActive: '#fff',
          colorTextMenuSecondary: 'rgba(255,255,255,0.45)',
        },
        sider: {
          colorMenuBackground: '#001529',
          colorTextMenu: 'rgba(255,255,255,0.65)',
          colorTextMenuActive: '#fff',
          colorTextMenuSelected: '#fff',
          colorTextMenuItemHover: 'rgba(255,255,255,0.85)',
          colorBgMenuItemHover: 'rgba(255,255,255,0.08)',
        },
      }}
      menuItemRender={(item, dom) => (
        <a
          onClick={(e) => {
            e.preventDefault();
            if (item.path) navigate(item.path);
          }}
        >
          {dom}
        </a>
      )}
      actionsRender={() => [
        <Dropdown
          key="user"
          menu={{ items: userMenuItems }}
          placement="bottomRight"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserOutlined />
            </div>
            <span style={{ fontSize: 14 }}>{username}</span>
          </div>
        </Dropdown>,
      ]}
      contentStyle={{ padding: 0 }}
    >
      <div
        style={{
          padding: 24,
          minHeight: 'calc(100vh - 48px)',
          background: token.colorBgLayout,
        }}
      >
        <Outlet />
      </div>
    </ProLayout>
  );
}
