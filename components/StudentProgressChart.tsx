import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Interfaces necesarias
interface StudentGradeEntry {
  topic: string;
  grade: string;
}

interface StudentSheetData {
  studentName: string;
  grades: { [date: string]: StudentGradeEntry };
}

interface ChartDataPoint {
  date: string;
  grade: number | null;
}

interface StudentProgressChartProps {
  sheetData: StudentSheetData[];
  allDates: string[];
  startDate: string;
  endDate: string;
}

const StudentProgressChart: React.FC<StudentProgressChartProps> = ({
  sheetData,
  allDates,
  startDate,
  endDate,
}) => {
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [studentChartData, setStudentChartData] = useState<ChartDataPoint[]>([]);

  // Función para convertir calificaciones a numéricas (copia local para auto-contención)
  const convertGradeToNumeric = (grade: string): number | null => {
    grade = String(grade).toUpperCase();
    switch (grade) {
      case 'L': return 9;
      case 'ML': return 6;
      case 'NL': return 3;
      default:
        const numGrade = parseFloat(grade);
        if (!isNaN(numGrade)) {
          return numGrade > 10 ? (numGrade / 100) * 10 : numGrade;
        }
        return null;
    }
  };

  // Efecto para inicializar el estudiante seleccionado
  useEffect(() => {
    if (sheetData.length > 0 && !selectedStudentName) {
      setSelectedStudentName(sheetData[0].studentName); // Seleccionar el primer estudiante por defecto
    }
  }, [sheetData, selectedStudentName]);

  // Efecto para recalcular los datos del gráfico cuando cambian las props o el estudiante seleccionado
  useEffect(() => {
    if (!selectedStudentName || !sheetData.length || !startDate || !endDate) {
      setStudentChartData([]);
      return;
    }

    const student = sheetData.find(s => s.studentName === selectedStudentName);
    if (!student) {
      setStudentChartData([]);
      return;
    }

    const startIdx = allDates.indexOf(startDate);
    const endIdx = allDates.indexOf(endDate);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      setStudentChartData([]);
      return;
    }

    // Filtrar las fechas relevantes dentro del rango seleccionado
    // Las actividades ya vienen pre-filtradas por processXLSXSheetData en StudentPerformanceApp
    const relevantDatesInSelectedRange: string[] = allDates.slice(startIdx, endIdx + 1).filter(date => {
        return student.grades[date] !== undefined; // Solo fechas para las que el estudiante tiene una entrada de calificación
    });

    const chartData: ChartDataPoint[] = relevantDatesInSelectedRange.map(date => {
      const gradeEntry = student.grades[date];
      const numericGrade = gradeEntry ? convertGradeToNumeric(gradeEntry.grade) : null;
      return {
        date: date,
        grade: numericGrade !== null ? parseFloat(numericGrade.toFixed(2)) : null,
      };
    }).filter(dataPoint => dataPoint.grade !== null); // Filtrar puntos sin calificación para un gráfico más limpio

    setStudentChartData(chartData);
  }, [selectedStudentName, sheetData, allDates, startDate, endDate]); // Dependencias

  return (
    <div className="mb-8">
      <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Progreso Individual del Estudiante</h3>

      {sheetData.length > 0 ? (
        <div className="mb-4">
          <label htmlFor="student-select-chart" className="block text-gray-700 text-sm font-bold mb-2">
            Seleccionar Estudiante:
          </label>
          <select
            id="student-select-chart"
            value={selectedStudentName}
            onChange={(e) => setSelectedStudentName(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            {sheetData.map((student) => (
              <option key={student.studentName} value={student.studentName}>
                {student.studentName}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-gray-600 mb-4">Carga datos para seleccionar un estudiante y ver su progreso.</p>
      )}

      {studentChartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={studentChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 9]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="grade" stroke="#8884d8" name="Calificación" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        selectedStudentName && sheetData.length > 0 && (
          <p className="text-center text-gray-600">No hay datos de calificaciones para {selectedStudentName} en el rango de fechas seleccionado.</p>
        )
      )}
    </div>
  );
};

export default StudentProgressChart;
