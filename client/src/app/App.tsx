import { RouterProvider } from 'react-router';
import { router } from './routes';
import { RepoProvider } from './context/RepoContext';

export default function App() {
  return (
    <RepoProvider>
      <RouterProvider router={router} />
    </RepoProvider>
  );
}
