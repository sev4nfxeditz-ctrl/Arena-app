import React from 'react';
import { NextPage } from 'next';

const Custom404: NextPage = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1 style={{ fontSize: '72px' }}>404 - Page Not Found</h1>
      <p style={{ fontSize: '24px' }}>Sorry, the page you are looking for does not exist.</p>
    </div>
  );
};

export default Custom404;