declare module 'html2canvas';
declare module 'jspdf';

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
