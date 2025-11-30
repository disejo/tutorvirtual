import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import QuantitativeAnalysisSection from './QuantitativeAnalysisSection';
import StudentProgressChart from './StudentProgressChart'; 
import StudentPendingActivities from './StudentPendingActivities';

// Declaración global para window.XLSX
// Esto es necesario porque la librería XLSX se carga dinámicamente en el navegador.
// En un proyecto Next.js real, podrías considerar instalar @types/xlsx para tipos más específicos,
// pero para una carga dinámica simple, 'any' es un punto de partida funcional.
declare global {
  interface Window {
    XLSX: any;
  }
}

// --- Interfaces para las estructuras de datos ---

interface StudentGradeEntry {
  topic: string;
  grade: string;
}

interface StudentSheetData {
  studentName: string;
  grades: { [date: string]: StudentGradeEntry };
}

interface StudentAverageDetail {
  currentAverage: string;
  missingActivities: number;
  lowGradeTopics: string[];
}

interface ActivityDetail {
  topic: string;
  average: string;
  students: StudentGradeDetail[];
}

interface StudentGradeDetail {
  studentName: string;
  grade: string;
}

interface StudentAtRisk {
  name: string;
  projectedAverage: string;
  missing: number;
  details: string[];
}

interface GradeCategoryCount {
  name: string;
  value: number;
}

interface ChartDataPoint {
  date: string;
  grade: number | null;
  averageGrade?: number | null; // Opcional para el gráfico de grupo
}

interface QualitativeStudentAverage {
  studentName: string;
  average: string; // Promedio numérico de calificaciones cualitativas (escala 1-9)
  details: { topic: string; grade: string }[]; // Detalles de las calificaciones cualitativas originales
}

interface AnalysisResults {
  studentAverages: { [studentName: string]: StudentAverageDetail };
  activitiesWithLowerGrades: ActivityDetail[];
  activitiesWithHigherGrades: ActivityDetail[];
  studentsAtRisk: StudentAtRisk[];
  gradeCategoryCounts: GradeCategoryCount[];
  bestStudentPerformanceData: ChartDataPoint[];
  bestStudentName: string;
  groupPerformanceData: ChartDataPoint[];
  studentQualitativeAverages: QualitativeStudentAverage[];
}

// Componente principal de la aplicación
const StudentPerformanceApp = () => {
    // Estado para almacenar los archivos XLSX cargados (workbook objects)
    // El tipo 'any' se usa aquí porque el objeto WorkBook de XLSX es complejo
    // y su tipo exacto dependería de la instalación de @types/xlsx.
    const [uploadedWorkbooks, setUploadedWorkbooks] = useState<{[fileName: string]: any}>({});
    // Estado para el nombre del archivo XLSX actualmente seleccionado
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    // Estado para el nombre de la hoja seleccionada dentro del XLSX
    const [selectedSheetName, setSelectedSheetName] = useState<string>('');
    // Estado para los datos parseados de la hoja seleccionada
    const [sheetData, setSheetData] = useState<StudentSheetData[]>([]);
    // Estado para todas las fechas disponibles en la hoja
    const [allDates, setAllDates] = useState<string[]>([]);
    // Estado para la fecha de inicio del rango de análisis
    const [startDate, setStartDate] = useState<string>('');
    // Estado para la fecha de fin del rango de análisis
    const [endDate, setEndDate] = useState<string>('');
    // Estado para los resultados del análisis
    const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
    // Estado para el mensaje de error
    const [error, setError] = useState<string>('');
    // Estado para indicar si la librería XLSX está cargada
    const [xlsxLoaded, setXlsxLoaded] = useState<boolean>(false);
    // Estado para indicar si la librería Recharts está cargada (asumimos que sí en este entorno)
    const [rechartsLoaded, setRechartsLoaded] = useState<boolean>(true); // Se asume que Recharts está disponible

    // Estados para el feedback del LLM
    const [llmFeedback, setLlmFeedback] = useState<string>('');
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState<boolean>(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
    const [feedbackStudentName, setFeedbackStudentName] = useState<string>('');

    // Nuevo estado para controlar la visibilidad de las listas de estudiantes en actividades
    const [expandedActivities, setExpandedActivities] = useState<{[key: string]: boolean}>({});

    // Colores para el gráfico de pastel de calificaciones (colores más claros)
    const PIE_COLORS: {[key: string]: string} = {
        'Logrado (L)': '#81C784',    // Light Green
        'Medianamente Logrado (ML)': '#FFD54F', // Light Amber
        'No Logrado (NL)': '#EF9A9A'   // Light Red
    };

    // Cargar la librería SheetJS (xlsx) dinámicamente
    useEffect(() => {
        console.log("DEBUG: Attempting to load XLSX library...");
        if (typeof window !== 'undefined') {
            if (window.XLSX) {
                console.log("DEBUG: XLSX library already loaded.");
                setXlsxLoaded(true);
            } else {
                const scriptXLSX = document.createElement('script');
                scriptXLSX.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
                scriptXLSX.onload = () => {
                    console.log("DEBUG: XLSX library loaded successfully.");
                    setXlsxLoaded(true);
                };
                scriptXLSX.onerror = () => {
                    console.error("DEBUG: Error loading XLSX library.");
                    setError("Error al cargar la librería XLSX. Por favor, recarga la página.");
                };
                document.head.appendChild(scriptXLSX);
            }
        }
    }, []);

    // Función para manejar la carga de archivos XLSX
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>): void => {
        setError('');
        const files = event.target.files;
        const newUploadedWorkbooks = { ...uploadedWorkbooks };

        if (!files) return;

        Array.from(files).forEach(file => {
            console.log(`DEBUG: Processing file: ${file.name}`);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (typeof window !== 'undefined' && window.XLSX) {
                        const data = new Uint8Array(e.target?.result as ArrayBuffer);
                        const workbook = window.XLSX.read(data, { type: 'array' });
                        newUploadedWorkbooks[file.name] = workbook;
                        setUploadedWorkbooks({ ...newUploadedWorkbooks });
                        console.log(`DEBUG: Workbook for ${file.name} loaded. Sheet names: ${workbook.SheetNames.join(', ')}`);

                        if (!selectedFileName) {
                            setSelectedFileName(file.name);
                            if (workbook.SheetNames.length > 0) {
                                setSelectedSheetName(workbook.SheetNames[0]);
                            }
                        }
                    } else {
                        setError("La librería XLSX no está cargada. Por favor, espera o recarga la página.");
                    }
                } catch (parseError) {
                    console.error("DEBUG: Error parsing XLSX:", parseError);
                    setError(`Error al procesar el archivo XLSX: ${file.name}. Asegúrate de que el formato sea correcto.`);
                }
            };
            reader.onerror = () => {
                console.error(`DEBUG: Error reading file: ${file.name}`);
                setError(`Error al leer el archivo: ${file.name}`);
            };
            reader.readAsArrayBuffer(file);
        });
    };

    // Efecto para procesar la hoja seleccionada cuando cambia el archivo o la hoja
    useEffect(() => {
        if (!xlsxLoaded) {
            console.log("DEBUG: XLSX library not loaded yet, skipping sheet processing.");
            return;
        }

        const workbook = uploadedWorkbooks[selectedFileName];
        console.log(`DEBUG: Selected file: ${selectedFileName}, Selected sheet: ${selectedSheetName}`);
        if (workbook && selectedSheetName) {
            try {
                if (typeof window !== 'undefined' && window.XLSX) {
                    const parsed = processXLSXSheetData(workbook, selectedSheetName);
                    setSheetData(parsed.data);
                    setAllDates(parsed.dates);
                    if (parsed.dates.length > 0) {
                        setStartDate(parsed.dates[0]);
                        setEndDate(parsed.dates[parsed.dates.length - 1]);
                    }
                    setAnalysisResults(null);
                    setError('');
                    console.log("DEBUG: Sheet data parsed successfully. Students:", parsed.data.length, "Dates:", parsed.dates.length);
                } else {
                    setError("La librería XLSX no está cargada. Por favor, espera o recarga la página.");
                }
            } catch (e: any) { // Usar 'any' para el error si no se conoce el tipo exacto
                console.error("DEBUG: Error processing sheet data:", e);
                setError("Error al procesar los datos de la hoja. Asegúrate de que el formato sea correcto y tenga al menos 3 filas (encabezados, temas, y datos de estudiante).");
                setSheetData([]);
                setAllDates([]);
                setAnalysisResults(null);
            }
        } else {
            setSheetData([]);
            setAllDates([]);
            setAnalysisResults(null);
            setError('');
            console.log("DEBUG: No workbook or sheet selected, clearing data.");
        }
    }, [selectedFileName, selectedSheetName, uploadedWorkbooks, xlsxLoaded]);

    // Función para convertir calificaciones cualitativas a numéricas (escala 1-9)
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

    // Función para verificar si una calificación es cualitativa (L, ML, NL)
    const isQualitativeGrade = (grade: string): boolean => {
        const upperGrade = String(grade).toUpperCase();
        return ['L', 'ML', 'NL'].includes(upperGrade);
    };

    // Función para procesar los datos de una hoja XLSX específica
    // Esta función ahora detecta automáticamente las columnas de actividad basándose en la presencia de calificaciones.
    const processXLSXSheetData = (workbook: any, sheetName: string): { data: StudentSheetData[]; dates: string[] } => {
        if (typeof window === 'undefined' || !window.XLSX) {
            throw new Error("XLSX library not available for processing.");
        }

        const worksheet = workbook.Sheets[sheetName];
        // sheet_to_json con header: 1 devuelve un array de arrays
        const jsonSheet: string[][] = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

        console.log("DEBUG: Raw JSON sheet data:", jsonSheet);

        if (jsonSheet.length < 3) {
            throw new Error("La hoja no tiene suficientes filas para el formato esperado.");
        }

        const headers = jsonSheet[0]; // Primera fila para encabezados (fechas)
        const topics = jsonSheet[1];   // Segunda fila para temas

        console.log("DEBUG: Headers (Dates row):", headers);
        console.log("DEBUG: Topics (Activities row):", topics);

        const dates: string[] = headers.slice(1).map((dateStr: any) => String(dateStr || '').trim());
        console.log("DEBUG: Extracted dates:", dates);

        const data: StudentSheetData[] = [];
        const validActivityColumns: { [date: string]: boolean } = {}; // Map date to boolean indicating if it's an activity column

        // Primera pasada: Determinar qué columnas son actividades válidas basándose en la presencia de calificaciones
        for (let j = 1; j < headers.length; j++) {
            const date = dates[j - 1];
            let hasValidGrade = false;
            // Iterar a través de las filas de estudiantes para esta columna
            for (let i = 2; i < jsonSheet.length; i++) {
                const row = jsonSheet[i];
                const grade = row[j] ? String(row[j]).trim() : '';
                if (convertGradeToNumeric(grade) !== null || isQualitativeGrade(grade)) {
                    hasValidGrade = true;
                    break; // Se encontró una calificación válida, esta es una columna de actividad
                }
            }
            validActivityColumns[date] = hasValidGrade;
        }
        console.log("DEBUG: Valid activity columns determined by content:", validActivityColumns);

        // Segunda pasada: Construir los datos del estudiante, incluyendo solo las columnas de actividad válidas
        for (let i = 2; i < jsonSheet.length; i++) {
            const row = jsonSheet[i];
            // Asegurarse de que el nombre del estudiante no esté vacío
            if (row[0] && String(row[0]).trim() !== '') {
                const studentName = String(row[0]).trim();
                const studentGrades: { [date: string]: StudentGradeEntry } = {};

                for (let j = 1; j < headers.length; j++) {
                    const date = dates[j - 1];
                    if (validActivityColumns[date]) { // Solo incluye si es una columna de actividad válida
                        const topic = topics[j] ? String(topics[j]).trim() : '';
                        const grade = row[j] ? String(row[j]).trim() : '';
                        studentGrades[date] = {
                            topic: topic,
                            grade: grade
                        };
                    }
                }
                data.push({ studentName, grades: studentGrades });
            } else {
                console.log(`DEBUG: Skipping row ${i} due to empty student name: "${row[0]}"`);
            }
        }
        console.log("DEBUG: Processed student data (filtered activities):", data);
        return { data, dates };
    };


    // Función principal para realizar el análisis
    const performAnalysis = (): void => {
        setError('');
        if (!sheetData.length || !startDate || !endDate) {
            setError("Por favor, carga un archivo, selecciona una hoja y un rango de fechas.");
            setAnalysisResults(null);
            return;
        }

        const startIdx = allDates.indexOf(startDate);
        const endIdx = allDates.indexOf(endDate);

        if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
            setError("Rango de fechas inválido. Asegúrate de que las fechas seleccionadas existan y el inicio sea anterior o igual al fin.");
            setAnalysisResults(null);
            return;
        }

        const relevantDatesInSelectedRange: string[] = allDates.slice(startIdx, endIdx + 1).filter(date => {
            // Filtra las fechas para incluir solo aquellas que tienen datos para al menos un estudiante
            // y que fueron identificadas como columnas de actividad en processXLSXSheetData.
            return sheetData.some(student => student.grades[date]);
        });
        console.log("DEBUG: Relevant dates in selected range (after filtering ignored topics):", relevantDatesInSelectedRange);


        const studentAverages: { [studentName: string]: StudentAverageDetail } = {};
        const activityGrades: { [topic: string]: { sum: number; count: number } } = {};
        const studentsAtRisk: StudentAtRisk[] = [];
        const gradeCategoryCounts: GradeCategoryCount[] = [
            { name: 'Logrado (L)', value: 0 },
            { name: 'Medianamente Logrado (ML)', value: 0 },
            { name: 'No Logrado (NL)', value: 0 }
        ];

        const bestStudentPerformanceData: ChartDataPoint[] = [];
        const groupPerformanceData: ChartDataPoint[] = [];
        let bestStudentName: string = '';
        let highestAverage: number = -1;

        // Nuevos objetos para almacenar estudiantes por actividad con bajas/altas calificaciones
        const lowGradeActivitiesDetails: { [topic: string]: StudentGradeDetail[] } = {};
        const highGradeActivitiesDetails: { [topic: string]: StudentGradeDetail[] } = {};


        sheetData.forEach(student => {
            let totalGradesForProjection: number = 0;
            let missingActivitiesCount: number = 0;
            let studentActivitiesCount: number = 0; // Total de actividades relevantes en el rango para este estudiante

            const currentStudentChartData: ChartDataPoint[] = [];

            relevantDatesInSelectedRange.forEach(date => {
                const activity = student.grades[date];
                if (activity) {
                    // Solo cuenta como actividad relevante si la columna fue identificada como válida
                    // y el estudiante tiene una entrada para esa fecha.
                    studentActivitiesCount++; 
                    const numericGrade = convertGradeToNumeric(activity.grade);
                    const originalGrade = String(activity.grade).trim().toUpperCase();

                    if (numericGrade !== null) {
                        // Si es una calificación válida (numérica o cualitativa convertida)
                        totalGradesForProjection += numericGrade;
                        if (isQualitativeGrade(originalGrade)) {
                            if (originalGrade === 'L') {
                                gradeCategoryCounts[0].value++;
                            } else if (originalGrade === 'ML') {
                                gradeCategoryCounts[1].value++;
                            } else if (originalGrade === 'NL') {
                                gradeCategoryCounts[2].value++;
                            }
                        }
                    } else {
                        // Si numericGrade es null, significa que la celda estaba vacía O contenía texto no reconocible.
                        // En ambos casos, se considera una actividad pendiente.
                        missingActivitiesCount++;
                        totalGradesForProjection += 3; // Asumir 'NL' (3 en escala 1-9) para tareas pendientes en la proyección
                    }

                    // Lógica para promedios de actividades (menores/mayores) - considera todas las notas numéricas
                    if (!activityGrades[activity.topic]) {
                        activityGrades[activity.topic] = { sum: 0, count: 0 };
                    }
                    if (numericGrade !== null) {
                        activityGrades[activity.topic].sum += numericGrade;
                        activityGrades[activity.topic].count++;
                    }

                    // Preparar data para el gráfico del estudiante (si es el mejor)
                    currentStudentChartData.push({
                        date: date,
                        grade: numericGrade !== null ? parseFloat(numericGrade.toFixed(2)) : null
                    });

                    // Recopilar detalles para actividades con bajas calificaciones
                    if (numericGrade !== null && numericGrade < 6) { // Menos de 6 (ML)
                        if (!lowGradeActivitiesDetails[activity.topic]) {
                            lowGradeActivitiesDetails[activity.topic] = [];
                        }
                        lowGradeActivitiesDetails[activity.topic].push({
                            studentName: student.studentName,
                            grade: activity.grade
                        });
                    }

                    // Recopilar detalles para actividades con altas calificaciones
                    if (numericGrade !== null && numericGrade >= 8) { // 8 o más (casi L o L)
                        if (!highGradeActivitiesDetails[activity.topic]) {
                            highGradeActivitiesDetails[activity.topic] = [];
                        }
                        highGradeActivitiesDetails[activity.topic].push({
                            studentName: student.studentName,
                            grade: activity.grade
                        });
                    }
                }
            });

            const currentAverageIncludingPending = studentActivitiesCount > 0 ? (totalGradesForProjection / studentActivitiesCount) : 0;

            studentAverages[student.studentName] = {
                currentAverage: currentAverageIncludingPending.toFixed(2),
                missingActivities: missingActivitiesCount,
                lowGradeTopics: Object.entries(student.grades)
                                    .filter(([date, activity]) => relevantDatesInSelectedRange.includes(date) && convertGradeToNumeric(activity.grade) !== null && convertGradeToNumeric(activity.grade)! < 6)
                                    .map(([date, activity]) => activity.topic)
                                    .filter((value, index, self) => self.indexOf(value) === index)
            };

            if (currentAverageIncludingPending > highestAverage) {
                highestAverage = currentAverageIncludingPending;
                bestStudentName = student.studentName;
                bestStudentPerformanceData.splice(0, bestStudentPerformanceData.length, ...currentStudentChartData);
            }

            if (currentAverageIncludingPending < 5 && studentActivitiesCount > 0) {
                studentsAtRisk.push({
                    name: student.studentName,
                    projectedAverage: currentAverageIncludingPending.toFixed(2),
                    missing: missingActivitiesCount,
                    details: relevantDatesInSelectedRange.filter(date => student.grades[date] && convertGradeToNumeric(student.grades[date].grade) === null)
                                        .map(date => `${student.grades[date].topic} (${date})`)
                });
            }
        });
        console.log("DEBUG: Student Averages (including pending):", studentAverages);


        const avgActivityGrades = Object.entries(activityGrades).map(([topic, data]) => ({
            topic,
            average: data.count > 0 ? (data.sum / data.count).toFixed(2) : '0' // Asegurar que el promedio es string
        }));

        const activitiesWithLowerGrades: ActivityDetail[] = [...avgActivityGrades]
            .sort((a, b) => parseFloat(a.average) - parseFloat(b.average))
            .slice(0, 5)
            .map(activity => ({
                ...activity,
                students: lowGradeActivitiesDetails[activity.topic] || []
            }));

        const activitiesWithHigherGrades: ActivityDetail[] = [...avgActivityGrades]
            .sort((a, b) => parseFloat(b.average) - parseFloat(a.average))
            .slice(0, 5)
            .map(activity => ({
                ...activity,
                students: highGradeActivitiesDetails[activity.topic] || []
            }));
        console.log("DEBUG: Activities with lower grades:", activitiesWithLowerGrades);
        console.log("DEBUG: Activities with higher grades:", activitiesWithHigherGrades);


        relevantDatesInSelectedRange.forEach(date => {
            let sumGradesForDate = 0;
            let countStudentsWithGradeForDate = 0;
            sheetData.forEach(student => {
                const activity = student.grades[date];
                if (activity) {
                    const numericGrade = convertGradeToNumeric(activity.grade);
                    if (numericGrade !== null) {
                        sumGradesForDate += numericGrade;
                        countStudentsWithGradeForDate++;
                    }
                }
            });
            groupPerformanceData.push({
                date: date,
                averageGrade: countStudentsWithGradeForDate > 0 ? parseFloat((sumGradesForDate / countStudentsWithGradeForDate).toFixed(2)) : null,
                grade: null // Añadir grade para consistencia con ChartDataPoint
            });
        });
        console.log("DEBUG: Group performance data:", groupPerformanceData);


        setAnalysisResults({
            studentAverages,
            activitiesWithLowerGrades,
            activitiesWithHigherGrades,
            studentsAtRisk,
            gradeCategoryCounts,
            bestStudentPerformanceData,
            bestStudentName,
            groupPerformanceData,
            studentQualitativeAverages: [] // Se mantiene aquí para evitar errores de tipo, aunque no se usa directamente en este componente.
        });
        console.log("DEBUG: Analysis results set.");
    };

    // Función para generar feedback usando la API Route de Next.js
    const generateFeedback = async (studentName: string, currentAverage: string, missingActivities: number, lowGradeTopics: string[]): Promise<void> => {
        setIsGeneratingFeedback(true);
        setLlmFeedback('');
        setFeedbackStudentName(studentName);
        setShowFeedbackModal(true);

        try {
            const payload = {
                studentName,
                currentAverage,
                missingActivities,
                lowGradeTopics
            };

            const response = await fetch('/api/generate-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                setLlmFeedback(result.feedback);
            } else {
                setLlmFeedback(`No se pudo generar el feedback. Error: ${result.error || 'Error desconocido del servidor.'} Por favor, verifica la consola del servidor de Next.js para más detalles y asegúrate de que tu clave de API de Gemini esté configurada correctamente en .env.local (GEMINI_API_KEY).`);
                console.error("DEBUG: Error de la API Route:", result.error);
            }
        } catch (apiError: any) {
            console.error("DEBUG: Error al llamar a la API Route:", apiError);
            setLlmFeedback("Error al conectar con el servidor para generar el feedback. Revisa tu conexión a internet o la consola del navegador.");
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    // Memoizar las opciones de fecha para los selectores
    const dateOptions = useMemo(() => {
        return allDates.map((date: string) => (
            <option key={date} value={date}>{date}</option>
        ));
    }, [allDates]);

    // Función para alternar la expansión de una actividad
    const toggleActivityExpansion = (activityTopic: string): void => {
        setExpandedActivities(prev => ({
            ...prev,
            [activityTopic]: !prev[activityTopic]
        }));
    };

    // Función para renderizar las etiquetas del Pie Chart con porcentajes
    // Las props de Recharts son complejas, se tipan como 'any' para simplificar.
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any): React.ReactElement => {
        // Calculate position for the label slightly outside the slice
        const radius = outerRadius * 1.2; // Place label 20% further out than the outer radius
        const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
        const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

        return (
            <text
                x={x}
                y={y}
                fill="#374151" // Dark gray for better contrast on lighter slices
                textAnchor={x > cx ? 'start' : 'end'} // Align text based on its position (left/right of center)
                dominantBaseline="central"
                className="text-sm font-semibold" // Tailwind classes for text styling
            >
                {`${name} (${(percent * 100).toFixed(0)}%)`}
            </text>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-inter text-gray-800">
            <header className="text-center mb-8">
                <h1 className="text-4xl font-extrabold text-blue-700 mb-2">Análisis de Rendimiento Estudiantil</h1>
                <p className="text-lg text-gray-600">Sube tus archivos de actividades para obtener un análisis detallado.</p>
            </header>

            {!xlsxLoaded ? (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg mb-8 text-center text-gray-600">
                    <p className="text-lg mb-4">Cargando la aplicación de análisis... Por favor, espera.</p>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                </div>
            ) : (
                <>
                    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg mb-8">
                        <div className="mb-6">
                            <label htmlFor="file-upload" className="block text-gray-700 text-sm font-bold mb-2">
                                1. Cargar Archivos de Actividades (.xlsx):
                            </label>
                            <input
                                id="file-upload"
                                type="file"
                                accept=".xlsx"
                                multiple
                                onChange={handleFileUpload}
                                className="block w-full text-sm text-gray-500
                                           file:mr-4 file:py-2 file:px-4
                                           file:rounded-full file:border-0
                                           file:text-sm file:font-semibold
                                           file:bg-blue-50 file:text-blue-700
                                           hover:file:bg-blue-100 cursor-pointer"
                            />
                            {Object.keys(uploadedWorkbooks).length > 0 && (
                                <div className="mt-2 text-sm text-gray-600">
                                    Archivos cargados: {Object.keys(uploadedWorkbooks).join(', ')}
                                </div>
                            )}
                        </div>

                        <div className="mb-6">
                            <label htmlFor="file-select" className="block text-gray-700 text-sm font-bold mb-2">
                                2. Seleccionar Archivo XLSX:
                            </label>
                            <select
                                id="file-select"
                                value={selectedFileName}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    setSelectedFileName(e.target.value);
                                    const workbook = uploadedWorkbooks[e.target.value];
                                    if (workbook && workbook.SheetNames.length > 0) {
                                        setSelectedSheetName(workbook.SheetNames[0]);
                                    } else {
                                        setSelectedSheetName('');
                                    }
                                }}
                                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                disabled={Object.keys(uploadedWorkbooks).length === 0}
                            >
                                <option value="">-- Selecciona un archivo --</option>
                                {Object.keys(uploadedWorkbooks).map((fileName: string) => (
                                    <option key={fileName} value={fileName}>{fileName}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-6">
                            <label htmlFor="sheet-select" className="block text-gray-700 text-sm font-bold mb-2">
                                3. Seleccionar Hoja:
                            </label>
                            <select
                                id="sheet-select"
                                value={selectedSheetName}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSheetName(e.target.value)}
                                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                disabled={!selectedFileName || !uploadedWorkbooks[selectedFileName]?.SheetNames.length}
                            >
                                <option value="">-- Selecciona una hoja --</option>
                                {selectedFileName && uploadedWorkbooks[selectedFileName]?.SheetNames.map((sheetName: string) => (
                                    <option key={sheetName} value={sheetName}>{sheetName}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="start-date" className="block text-gray-700 text-sm font-bold mb-2">
                                    4. Fecha de Inicio:
                                </label>
                                <select
                                    id="start-date"
                                    value={startDate}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStartDate(e.target.value)}
                                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    disabled={!sheetData.length}
                                >
                                    {dateOptions}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="end-date" className="block text-gray-700 text-sm font-bold mb-2">
                                    Fecha de Fin:
                                    </label>
                                <select
                                    id="end-date"
                                    value={endDate}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEndDate(e.target.value)}
                                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    disabled={!sheetData.length}
                                >
                                    {dateOptions}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={performAnalysis}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!sheetData.length || !startDate || !endDate}
                        >
                            Realizar Análisis
                        </button>

                        {error && (
                            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
                                {error}
                            </div>
                        )}
                    </div>

                    {analysisResults && (
                        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg">
                            <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center">Resultados del Análisis</h2>

                            {/* Promedio de un rango de columnas */}
                            <div className="mb-8">
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Promedio de Calificaciones por Estudiante (Rango Seleccionado)</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full bg-white rounded-lg shadow-md">
                                        <thead className="bg-blue-50">
                                            <tr>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Estudiante</th>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Promedio Actual (1-9)</th>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Tareas Pendientes</th>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {Object.entries(analysisResults.studentAverages).map(([studentName, data]: [string, StudentAverageDetail]) => (
                                                <tr key={studentName} className="hover:bg-gray-50">
                                                    <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{studentName}</td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{data.currentAverage}</td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{data.missingActivities}</td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">
                                                        <button
                                                            onClick={() => generateFeedback(studentName, data.currentAverage, data.missingActivities, data.lowGradeTopics)}
                                                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                                                            disabled={isGeneratingFeedback}
                                                        >
                                                            ✨ Generar Feedback
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Modal de Feedback del LLM */}
                            {showFeedbackModal && (
                                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
                                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                                        <h3 className="text-xl font-bold text-gray-900 mb-4">Feedback para {feedbackStudentName}</h3>
                                        {isGeneratingFeedback ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                                                <p className="ml-4 text-gray-700">Generando feedback...</p>
                                            </div>
                                        ) : (
                                            <p className="text-gray-700 whitespace-pre-wrap">{llmFeedback}</p>
                                        )}
                                        <div className="mt-6 text-right">
                                            <button
                                                onClick={() => setShowFeedbackModal(false)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
                                            >
                                                Cerrar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <hr className="my-8" /> 
                            {/* Componente de Actividades Pendientes por Estudiante */}
                            {/* Este componente se renderiza solo si hay datos de hoja, fechas de inicio y fin seleccionadas */}
                            {sheetData.length > 0 && allDates.length > 0 && startDate && endDate && (
                                <StudentPendingActivities
                                    sheetData={sheetData}
                                    allDates={allDates}
                                    startDate={startDate}
                                    endDate={endDate}
                                />
                            )}
                            <hr className="my-8" />   
                            {/* Actividades con menores notas */}
                            <div className="mb-8">
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Actividades con Menores Calificaciones</h3>
                                <ul className="list-none space-y-3 text-gray-700">
                                    {analysisResults.activitiesWithLowerGrades.length > 0 ? (
                                        analysisResults.activitiesWithLowerGrades.map((item: ActivityDetail, index: number) => (
                                            <li key={index} className="bg-red-50 p-3 rounded-md shadow-sm">
                                                <button
                                                    onClick={() => toggleActivityExpansion(item.topic + '-low')}
                                                    className="font-medium text-red-700 w-full text-left flex justify-between items-center"
                                                >
                                                    <span>{item.topic}: Promedio general del grupo: {item.average}</span>
                                                    <span>{expandedActivities[item.topic + '-low'] ? '▲' : '▼'}</span>
                                                </button>
                                                {expandedActivities[item.topic + '-low'] && item.students.length > 0 && (
                                                    <ul className="mt-2 ml-4 list-none text-sm text-gray-600">
                                                        {item.students.map((studentDetail: StudentGradeDetail, sIdx: number) => (
                                                            <li key={sIdx}>{studentDetail.studentName}: {studentDetail.grade}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {expandedActivities[item.topic + '-low'] && item.students.length === 0 && (
                                                    <p className="mt-2 ml-4 text-sm text-gray-600">No hay detalles de estudiantes para esta actividad.</p>
                                                )}
                                            </li>
                                        ))
                                    ) : (
                                        <p className="text-gray-600">No hay datos suficientes para determinar actividades con menores calificaciones.</p>
                                    )}
                                </ul>
                            </div>

                            {/* Actividades con mejores calificaciones */}
                            <div className="mb-8">
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Actividades con Mejores Calificaciones</h3>
                                <ul className="list-none space-y-3 text-gray-700">
                                    {analysisResults.activitiesWithHigherGrades.length > 0 ? (
                                        analysisResults.activitiesWithHigherGrades.map((item: ActivityDetail, index: number) => (
                                            <li key={index} className="bg-green-50 p-3 rounded-md shadow-sm">
                                                <button
                                                    onClick={() => toggleActivityExpansion(item.topic + '-high')}
                                                    className="font-medium text-green-700 w-full text-left flex justify-between items-center"
                                                >
                                                    <span>{item.topic}: Promedio {item.average}</span>
                                                    <span>{expandedActivities[item.topic + '-high'] ? '▲' : '▼'}</span>
                                                </button>
                                                {expandedActivities[item.topic + '-high'] && item.students.length > 0 && (
                                                    <ul className="mt-2 ml-4 list-none text-sm text-gray-600">
                                                        {item.students.map((studentDetail: StudentGradeDetail, sIdx: number) => (
                                                            <li key={sIdx}>{studentDetail.studentName}: {studentDetail.grade}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {expandedActivities[item.topic + '-high'] && item.students.length === 0 && (
                                                    <p className="mt-2 ml-4 text-sm text-gray-600">No hay detalles de estudiantes para esta actividad.</p>
                                                )}
                                            </li>
                                        ))
                                    ) : (
                                        <p className="text-gray-600">No hay datos suficientes para determinar actividades con mejores calificaciones.</p>
                                    )}
                                </ul>
                            </div>
                            <hr className="my-8" />           
                            {/* Proyección de estudiantes en riesgo de perder la asignatura */}
                            <div className="mb-8">
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Estudiantes con Probabilidad de Reprobar (Proyección)</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full bg-white rounded-lg shadow-md">
                                        <thead className="bg-red-50">
                                            <tr>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Estudiante</th>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Promedio Proyectado (1-9)</th>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Tareas Pendientes</th>
                                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Detalle Pendientes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {Object.values(analysisResults.studentsAtRisk).map((student: StudentAtRisk, index: number) => (
                                                <tr key={index} className="hover:bg-red-50">
                                                    <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{student.projectedAverage}</td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{student.missing}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-700">
                                                        {student.details.length > 0 ? (
                                                            <ul className="list-disc list-inside">
                                                                {student.details.map((detail: string, idx: number) => (
                                                                    <li key={idx}>{detail}</li>
                                                                ))}
                                                            </ul>
                                                        ) : 'N/A'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* Integrar el nuevo componente QuantitativeAnalysisSection */}
                            {/* Se renderiza solo si hay datos de hoja, fechas de inicio y fin seleccionadas */}
                            {sheetData.length > 0 && startDate && endDate && (
                                <QuantitativeAnalysisSection
                                    sheetData={sheetData}
                                    allDates={allDates}
                                    startDate={startDate}
                                    endDate={endDate}
                                />
                            )}
                            <hr className="my-8" />
                            {/* Gráfico de Progreso Individual del Estudiante */}
                            {/* Este componente se renderiza solo si hay datos de hoja, fechas de inicio y fin seleccionadas */}
                            {/* y si hay al menos un estudiante con datos de calificaciones */}
                            {sheetData.length > 0 && allDates.length > 0 && startDate && endDate && (
                                <StudentProgressChart
                                    sheetData={sheetData}
                                    allDates={allDates}
                                    startDate={startDate}
                                    endDate={endDate}
                                />
                            )}
                            <hr className="my-8" />

                            {/* Gráfico de Distribución Global de Calificaciones (Pie Chart) */}
                            <div className="mb-8">
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Distribución Global de Calificaciones</h3>
                                {analysisResults.gradeCategoryCounts.some((cat: GradeCategoryCount) => cat.value > 0) ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={analysisResults.gradeCategoryCounts}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={renderCustomizedLabel}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {analysisResults.gradeCategoryCounts.map((entry: GradeCategoryCount, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-center text-gray-600">No hay datos de calificaciones L/ML/NL para mostrar en el gráfico.</p>
                                )}
                            </div>
                            <hr className="my-8" />
                            {/* Gráfico de Rendimiento del Mejor Alumno */}
                            {analysisResults.bestStudentName && analysisResults.bestStudentPerformanceData.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Rendimiento de {analysisResults.bestStudentName}</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={analysisResults.bestStudentPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis domain={[0, 9]} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="grade" stroke="#82ca9d" name="Calificación" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                            <hr className="my-8" />
                            {/* Gráfico de Rendimiento General del Grupo */}
                            {analysisResults.groupPerformanceData.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Rendimiento General del Grupo</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={analysisResults.groupPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis domain={[0, 9]} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="averageGrade" stroke="#8884d8" name="Promedio del Grupo" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                            <hr className="my-8" />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StudentPerformanceApp;
