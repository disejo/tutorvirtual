import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// Interfaces necesarias
interface StudentGradeEntry {
  topic: string;
  grade: string;
}

interface StudentSheetData {
  studentName: string;
  grades: { [date: string]: StudentGradeEntry };
}

interface QuantitativeStudentAverage {
  studentName: string;
  average: string; // Promedio numérico de calificaciones cuantitativas (escala 1-9)
  details: { topic: string; grade: string }[]; // Detalles de las calificaciones cuantitativas originales
}

interface QuantitativeAnalysisSectionProps {
  sheetData: StudentSheetData[];
  allDates: string[];
  startDate: string;
  endDate: string;
}

const QuantitativeAnalysisSection: React.FC<QuantitativeAnalysisSectionProps> = ({
  sheetData,
  allDates,
  startDate,
  endDate,
}) => {
  const [studentQuantitativeAverages, setStudentQuantitativeAverages] = useState<QuantitativeStudentAverage[]>([]);
  // Estado local para controlar la visibilidad de las listas de estudiantes en actividades
  const [expandedActivities, setExpandedActivities] = useState<{[key: string]: boolean}>({});

  // Colores para el gráfico de promedios cuantitativos (aprobar/desaprobar)
  const CHART_PASS_FAIL_COLORS: {[key: string]: string} = {
    'Aprobado': '#4CAF50', // Green
    'Desaprobado': '#F44336' // Red
  };

  // Función para convertir calificaciones a numéricas
  const convertGradeToNumeric = (grade: string): number | null => {
    grade = String(grade).toUpperCase();
    switch (grade) {
      case 'L': return 9;
      case 'ML': return 6;
      case 'NL': return 3;
      default:
        const numGrade = parseFloat(grade);
        if (!isNaN(numGrade)) {
          return numGrade > 9 ? (numGrade / 100) * 9 : numGrade;
        }
        return null;
    }
  };

  // Función para verificar si una calificación es cualitativa
  const isQualitativeGrade = (grade: string): boolean => {
    const upperGrade = String(grade).toUpperCase();
    return ['L', 'ML', 'NL'].includes(upperGrade);
  };

  // Función para verificar si una calificación es puramente numérica
  const isQuantitativeGrade = (grade: string): boolean => {
    const numGrade = parseFloat(grade);
    return !isNaN(numGrade) && !isQualitativeGrade(grade);
  };

  // Función para alternar la expansión de una actividad o estudiante
  const toggleExpansion = (key: string): void => {
    setExpandedActivities(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Efecto para calcular los promedios cuantitativos cuando los datos cambian
  useEffect(() => {
    if (!sheetData.length || !startDate || !endDate) {
      setStudentQuantitativeAverages([]);
      return;
    }

    const startIdx = allDates.indexOf(startDate);
    const endIdx = allDates.indexOf(endDate);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      setStudentQuantitativeAverages([]);
      return;
    }

    const relevantDatesInSelectedRange: string[] = allDates.slice(startIdx, endIdx + 1).filter(date => {
      return sheetData.some(student => student.grades[date]);
    });

    const quantitativeAverages: QuantitativeStudentAverage[] = [];

    sheetData.forEach(student => {
      let quantitativeGradesSum = 0;
      let quantitativeGradesCount = 0;
      const quantitativeDetails: { topic: string; grade: string }[] = [];

      relevantDatesInSelectedRange.forEach(date => {
        const activity = student.grades[date];
        if (activity) {
          const numericGrade = convertGradeToNumeric(activity.grade);
          const originalGrade = String(activity.grade).toUpperCase();

          if (isQuantitativeGrade(activity.grade)) {
            quantitativeGradesSum += numericGrade!;
            quantitativeGradesCount++;
            quantitativeDetails.push({ topic: activity.topic, grade: originalGrade });
          }
        }
      });

      if (quantitativeGradesCount > 0) {
        const average = (quantitativeGradesSum / quantitativeGradesCount).toFixed(2);
        quantitativeAverages.push({
          studentName: student.studentName,
          average: average,
          details: quantitativeDetails
        });
      }
    });
    setStudentQuantitativeAverages(quantitativeAverages);
  }, [sheetData, allDates, startDate, endDate]); // Dependencias del useEffect

  return (
    <>
      {/* Promedio de calificaciones cuantitativas por estudiante */}
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Promedio de Calificaciones Cuantitativas por Estudiante</h3>
        <ul className="list-none space-y-3 text-gray-700">
          {studentQuantitativeAverages.length > 0 ? (
            studentQuantitativeAverages.map((studentAvg: QuantitativeStudentAverage, index: number) => (
              <li key={index} className="bg-purple-50 p-3 rounded-md shadow-sm">
                <button
                  onClick={() => toggleExpansion(studentAvg.studentName + '-quantitative')}
                  className="font-medium text-purple-700 w-full text-left flex justify-between items-center"
                >
                  <span>{studentAvg.studentName}: Promedio {studentAvg.average}</span>
                  <span>{expandedActivities[studentAvg.studentName + '-quantitative'] ? '▲' : '▼'}</span>
                </button>
                {expandedActivities[studentAvg.studentName + '-quantitative'] && studentAvg.details.length > 0 && (
                  <ul className="mt-2 ml-4 list-none text-sm text-gray-600">
                    {studentAvg.details.map((detail: { topic: string; grade: string }, dIdx: number) => (
                      <li key={dIdx}>{detail.topic}: {detail.grade}</li>
                    ))}
                  </ul>
                )}
                {expandedActivities[studentAvg.studentName + '-quantitative'] && studentAvg.details.length === 0 && (
                  <p className="mt-2 ml-4 text-sm text-gray-600">No hay calificaciones cuantitativas para este estudiante en el rango seleccionado.</p>
                )}
              </li>
            ))
          ) : (
            <p className="text-gray-600">No hay datos de calificaciones cuantitativas para analizar en el rango seleccionado.</p>
          )}
        </ul>
      </div>


    </>
  );
};

export default QuantitativeAnalysisSection;
