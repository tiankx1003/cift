import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import BasicLayout from './components/BasicLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import KbDetail from './pages/KbDetail';
import Manage from './pages/Manage';
import ChunkPreview from './pages/ChunkPreview';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<BasicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/kb/:kbId" element={<KbDetail />} />
              <Route path="/manage" element={<Manage />} />
              <Route path="/kb/:kbId/documents/:docId/preview" element={<ChunkPreview />} />
              <Route path="/graph" element={<KnowledgeGraphPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}
