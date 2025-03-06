import React from 'react';

const CustomButton = ({ children, onClick, className = '', ...props }) => {
  // console.log(props);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default React.memo(CustomButton);