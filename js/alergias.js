// Catálogo común de alergias y dietas (web, panel y PDF).
// Los códigos coinciden con los que admite la base de datos.
window.ALERGIAS = [
  { id: 'gluten', nombre: 'Gluten', corto: 'GLU', tipo: 'alergia' },
  { id: 'lactosa', nombre: 'Lactosa', corto: 'LAC', tipo: 'alergia' },
  { id: 'huevo', nombre: 'Huevo', corto: 'HUE', tipo: 'alergia' },
  { id: 'frutos_secos', nombre: 'Frutos secos', corto: 'FSE', tipo: 'alergia' },
  { id: 'cacahuete', nombre: 'Cacahuete', corto: 'CAC', tipo: 'alergia' },
  { id: 'marisco', nombre: 'Marisco', corto: 'MAR', tipo: 'alergia' },
  { id: 'moluscos', nombre: 'Moluscos', corto: 'MOL', tipo: 'alergia' },
  { id: 'pescado', nombre: 'Pescado', corto: 'PES', tipo: 'alergia' },
  { id: 'soja', nombre: 'Soja', corto: 'SOJ', tipo: 'alergia' },
  { id: 'sesamo', nombre: 'Sésamo', corto: 'SES', tipo: 'alergia' },
  { id: 'mostaza', nombre: 'Mostaza', corto: 'MOS', tipo: 'alergia' },
  { id: 'apio', nombre: 'Apio', corto: 'API', tipo: 'alergia' },
  { id: 'sulfitos', nombre: 'Sulfitos', corto: 'SUL', tipo: 'alergia' },
  { id: 'altramuces', nombre: 'Altramuces', corto: 'ALT', tipo: 'alergia' },
  { id: 'vegetariano', nombre: 'Vegetariana', corto: 'VGT', tipo: 'dieta' },
  { id: 'vegano', nombre: 'Vegana', corto: 'VGN', tipo: 'dieta' },
  { id: 'sin_cerdo', nombre: 'Sin cerdo', corto: 'S/C', tipo: 'dieta' },
  { id: 'embarazada', nombre: 'Embarazada', corto: 'EMB', tipo: 'dieta' }
];
window.ALERGIA = Object.fromEntries(window.ALERGIAS.map(a => [a.id, a]));
