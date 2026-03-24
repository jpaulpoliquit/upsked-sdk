const { randomUUID } = require('crypto');

const daysMap = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'TH',
  fri: 'F',
  sat: 'S',
  sun: 'SU',
};

function parseTimeStr(timeStr) {
  if (!timeStr) return '';
  const compact = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (compact) {
    let hours = parseInt(compact[1], 10);
    const minutes = compact[2];
    const period = compact[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}${minutes}`;
  }
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');
  hours = parseInt(hours, 10);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}${minutes}`;
}

function formatTime(cls) {
  let blocks = [];

  const extractFromObj = (obj) => {
    const activeDays = Object.keys(daysMap).filter((d) => obj[d] === true).map((d) => daysMap[d]);
    if (activeDays.length === 0) return null;
    const daysStr = activeDays.join('-');
    const start = parseTimeStr(obj.start_time);
    const end = parseTimeStr(obj.end_time);
    if (!start) return daysStr;
    return `${daysStr} ${start}-${end}`;
  };

  if (cls.class_dates && cls.class_dates.length > 0) {
    blocks = cls.class_dates.map(extractFromObj).filter(Boolean);
  }

  if (blocks.length === 0) {
    const rootBlock = extractFromObj(cls);
    if (rootBlock) blocks.push(rootBlock);
  }

  return blocks.length > 0 ? blocks.join('; ') : 'TBA';
}

/**
 * @param {object[]} classesData - AMIS `/api/students/classes` response `classes.data` rows
 */
function transformAmisClasses(classesData) {
  return classesData.map((cls) => {
    let instructors = [];
    if (cls.faculties && Array.isArray(cls.faculties)) {
      instructors = cls.faculties
        .map((f) => {
          const name =
            f.faculty?.user?.formatted_name ||
            `${f.faculty?.user?.last_name}, ${f.faculty?.user?.first_name}`;
          return name.replace(/\.$/, '');
        })
        .filter(Boolean);
    }
    const instructorStr = instructors.length > 0 ? instructors.join('; ') : 'TBA';

    let roomStr = 'TBA';
    if (cls.class_dates && cls.class_dates.length > 0) {
      const rooms = cls.class_dates.map((cd) => cd.room?.facility_name || 'TBA');
      roomStr = [...new Set(rooms)].join(' / ');
    }

    const courseTitle = cls.course?.title || cls.course_code || 'UNKNOWN TITLE';

    return {
      id: randomUUID(),
      deptCode: cls.course?.acad_org || 'UPLB',
      catNo: cls.course_code,
      section: cls.section || '--',
      courseTitle,
      units: cls.credit ? cls.credit.toString() : '3',
      time: formatTime(cls),
      room: roomStr,
      instructor: instructorStr,
      remarks: `Max: ${cls.max_class_size} | Enrolled: ${cls.active_class_size} | Status: ${cls.status}`,
    };
  });
}

module.exports = { transformAmisClasses, formatTime };
