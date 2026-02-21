import { RouterProvider } from 'react-router';
import { router } from './routes';
import '../styles/index.css';

export default function App() {
  return <RouterProvider router={router} />;
}