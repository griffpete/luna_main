import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Structure } from "./components/Structure";
import { Chat } from "./components/Chat";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "structure", Component: Structure },
      { path: "chat", Component: Chat },
      { path: "settings", Component: Settings },
    ],
  },
]);
