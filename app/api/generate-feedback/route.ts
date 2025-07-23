// app/api/generate-feedback/route.ts
// Este archivo define una API Route para manejar la generación de feedback
// utilizando la API de Gemini de forma segura en el lado del servidor.

import { NextResponse } from 'next/server';

/**
 * Maneja las solicitudes POST para generar feedback.
 * @param {Request} request - El objeto de solicitud entrante.
 * @returns {Promise<NextResponse>} La respuesta que contiene el feedback generado o un mensaje de error.
 */
export async function POST(request: Request) {
    // 1. Obtener la clave de API de Gemini de las variables de entorno del servidor.
    // NOTA: Para variables de entorno del lado del servidor, NO se usa 'NEXT_PUBLIC_'.
    const apiKey = process.env.GEMINI_API_KEY;

    // Verificar si la clave de API está configurada.
    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY no está configurada en las variables de entorno del servidor.");
        return NextResponse.json(
            { error: "La clave de API de Gemini no está configurada en el servidor." },
            { status: 500 }
        );
    }

    try {
        // 2. Parsear el cuerpo de la solicitud JSON enviada desde el cliente.
        const { studentName, currentAverage, missingActivities, lowGradeTopics } = await request.json();

        // 3. Construir el prompt para el modelo de lenguaje de Gemini.
        const prompt = `Eres un asistente educativo. Genera un feedback personalizado para el estudiante ${studentName} basado en su rendimiento. Su promedio actual es ${currentAverage} (escala 1-9). Le faltan ${missingActivities} actividades. Sus temas con calificaciones más bajas son: ${lowGradeTopics.length > 0 ? lowGradeTopics.join(', ') : 'ninguno'}. Incluye sugerencias constructivas para mejorar y un mensaje de aliento.`;

        // 4. Preparar el payload para la solicitud a la API de Gemini.
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            // Puedes añadir otras configuraciones aquí si las necesitas, por ejemplo:
            // generationConfig: {
            //     temperature: 0.7,
            //     topK: 40,
            //     topP: 0.95,
            //     maxOutputTokens: 500,
            // },
        };

        // 5. Realizar la solicitud a la API de Gemini.
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // 6. Parsear la respuesta de la API de Gemini.
        const result = await response.json();

        // 7. Extraer el texto del feedback de la respuesta.
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const feedbackText = result.candidates[0].content.parts[0].text;
            // Devolver el feedback al cliente.
            return NextResponse.json({ feedback: feedbackText }, { status: 200 });
        } else {
            console.error("DEBUG: Estructura de respuesta inesperada de la API de Gemini:", result);
            return NextResponse.json(
                { error: "No se pudo generar el feedback. Estructura de respuesta inesperada." },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error("Error al generar feedback:", error);
        return NextResponse.json(
            { error: "Error interno del servidor al generar el feedback." },
            { status: 500 }
        );
    }
}
