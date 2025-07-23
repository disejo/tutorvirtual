'use client';
import dynamic from 'next/dynamic';

const DynamicStudentPerformanceApp = dynamic(
  () => import('../components/StudentPerformanceApp'),
  { ssr: false } // Deshabilita el Server-Side Rendering para este componente
);

export default function Home() {
  return (
    <div>
      <DynamicStudentPerformanceApp />
    </div>
  );
}
