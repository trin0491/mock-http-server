const gulp = require('gulp');

gulp.task('copy:packages', () => {
  return gulp.src('package.json')
    .pipe(gulp.dest('dist'));
});