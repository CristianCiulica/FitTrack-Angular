import { Injectable } from '@angular/core';
import { Workout } from '../models/workout.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class ExportService {
  exportToPDF(workouts: Workout[]) {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('FitTrack – Workout History', 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

    const flattened = workouts.flatMap(w =>
      w.exercises?.map(ex => [w.name, ex.exerciseName, ex.muscleGroup, ex.sets, ex.reps, ex.weight, w.date]) || []
    );

    autoTable(doc, {
      startY: 35,
      head: [['Workout Name', 'Exercise', 'Muscle Group', 'Sets', 'Reps', 'Weight (kg)', 'Date']],
      body: flattened,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 0, 0] },
    });

    doc.save('fittrack-workouts.pdf');
  }

  exportToExcel(workouts: Workout[]) {
    const data = workouts.flatMap((w) =>
      w.exercises?.map(ex => ({
        'Workout Name': w.name,
        'Exercise': ex.exerciseName,
        'Muscle Group': ex.muscleGroup,
        'Sets': ex.sets,
        'Reps': ex.reps,
        'Weight (kg)': ex.weight,
        'Date': w.date,
        'Notes': w.notes ?? '',
      })) || []
    );

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workouts');
    XLSX.writeFile(wb, 'fittrack-workouts.xlsx');
  }
}
