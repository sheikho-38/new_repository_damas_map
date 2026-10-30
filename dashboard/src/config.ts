// عنوان الباك إند. غيّره من ملف .env عند النشر (VITE_API_URL)
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:8000/api`
