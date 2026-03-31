import type { AppProps } from 'next/app';
import '../src/App.css';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;
