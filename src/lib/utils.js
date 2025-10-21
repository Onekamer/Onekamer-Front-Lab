import { clsx } from "clsx"
    import { twMerge } from "tailwind-merge"

    export function cn(...inputs) {
      return twMerge(clsx(inputs))
    }

    export const getInitials = (username) => {
      if (!username || username.trim() === "") {
        return "OK";
      }
      return username.charAt(0).toUpperCase();
    };