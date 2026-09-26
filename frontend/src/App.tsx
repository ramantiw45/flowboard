import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/boards" element={<DashboardPage />} />
        <Route path="/boards/:boardId" element={<BoardPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/boards" replace />} />
      <Route path="*" element={<Navigate to="/boards" replace />} />
    </Routes>
  );
}
