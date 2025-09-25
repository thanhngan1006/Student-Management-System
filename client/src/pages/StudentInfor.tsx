import { IoMdAdd } from "react-icons/io";
import { useEffect, useState } from "react";
import StudentList from "../components/StudentList";
import { CiImport } from "react-icons/ci";
import axios from "axios";
import Swal from "sweetalert2";

const StudentInfor = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const [isAdding, setIsAdding] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  
  const [newStudent, setNewStudent] = useState({
    name: "",
    tdt_id: "",
    gender: "",
    dateOfBirth: "",
    phoneNumber: "",
    parentPhoneNumber: "",
    address: "",
    role: "student",
    email: "",
    class: "",
  });

  const isAdvisor = user.role === "advisor";
  const isAdmin = user.role === "admin";

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        if (isAdvisor) {
          const advisorId = user.id || user._id;
          const classRes = await axios.get(`http://localhost:4000/api/teachers/${advisorId}/class`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const studentIds = classRes.data.class?.students || [];
          setClassId(classRes.data.class?.class_id || "");

          if (studentIds.length === 0) return setStudents([]);

          const usersRes = await axios.post(
            `http://localhost:4003/api/users/batch`,
            { ids: studentIds },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          setStudents(usersRes.data);
          setFilteredStudents(usersRes.data);
        } else if (isAdmin) {
          const classRes = await axios.get("http://localhost:4000/api/classes", {
            headers: { Authorization: `Bearer ${token}` },
          });

          setAvailableClasses(classRes.data);
          const allStudentIds = classRes.data.flatMap((cls: any) => cls.class_member);

          const usersRes = await axios.post(
            `http://localhost:4003/api/users/batch`,
            { ids: allStudentIds },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const enriched = usersRes.data.map((stu: any) => {
            const foundClass = classRes.data.find((cls: any) => cls.class_member.includes(stu._id));
            return { ...stu, class_id: foundClass?.class_id || "" };
          });

          setStudents(enriched);
          setFilteredStudents(enriched);
        }
      } catch (err) {
        console.error("Lỗi khi lấy danh sách sinh viên:", (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  useEffect(() => {
    const result = students.filter((student) => {
      const matchesSearch = Object.values(student).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesClass = selectedClassId === "" || student.class_id === selectedClassId;
      return matchesSearch && matchesClass;
    });
    setFilteredStudents(result);
  }, [searchTerm, selectedClassId, students]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewStudent({ ...newStudent, [name]: value });
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    const formData = new FormData();
    formData.append("file", file);
  
    try {
      const res = await axios.post(
        `http://localhost:4000/api/classes/${classId}/import-students`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
  
      Swal.fire({
        title: "Kết quả Import",
        html: `
          <p>Đã thêm: <b>${res.data.addedCount}</b> sinh viên</p>
          ${
            res.data.alreadyInClass.length > 0
              ? `<p>Sinh viên này đã có trong lớp:</p><ul style="text-align: center">${res.data.alreadyInClass
                  .map((email: string) => `<li>${email}</li>`)
                  .join("")}</ul>`
              : ""
          }
        `,
        icon: "success",
        width: 600
      });
  
      // Gọi lại danh sách sinh viên sau khi import
      const updatedClass = res.data.updatedClass;
      const newUserIds = updatedClass.class_member;
  
      const usersRes = await axios.post(
        `http://localhost:4003/api/users/batch`,
        { ids: newUserIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      setStudents(usersRes.data);
    } catch (error: any) {
      console.error("Lỗi import CSV:", error);
      Swal.fire("Lỗi", error.response?.data?.message || "Import thất bại", "error");
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAdvisor) {
      try {
        const res = await axios.post(
          `http://localhost:4000/api/classes/${classId}/add-student`,
          { email: newStudent.email },
          { headers: { Authorization: `Bearer ${token}` } }
        );
  
        Swal.fire("Thành công", "Đã thêm sinh viên vào lớp", "success");
  
        // Gọi lại danh sách sinh viên sau khi thêm
        const updatedClass = res.data.class;
        const newUserIds = updatedClass.class_member;
        const usersRes = await axios.post(
          `http://localhost:4003/api/users/batch`,
          { ids: newUserIds },
          { headers: { Authorization: `Bearer ${token}` } }
        );
  
        setStudents(usersRes.data);
        setIsAdding(false);
      } catch (error: any) {
        const message = error?.response?.data?.message;
        if (message === "Sinh viên đã tồn tại trong lớp") {
          Swal.fire("Thông báo", message, "warning");
        } else {
          Swal.fire("Lỗi", message || "Không thể thêm sinh viên", "error");
        }
      }
    }else if (isAdmin) {
      await handleAddStudentByAdmin();
    }
  };

  const handleAddStudentByAdmin = async () => {
    try {
      const token = localStorage.getItem("token");
  
      const payload = {
        name: newStudent.name,
        tdt_id: newStudent.tdt_id,
        gender: newStudent.gender,
        phone_number: newStudent.phoneNumber,
        parent_number: newStudent.parentPhoneNumber,
        address: newStudent.address,
        date_of_birth: newStudent.dateOfBirth,
        email: newStudent.email,
      };
  
      const res = await axios.post("http://localhost:4003/api/users/add-student", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      Swal.fire("Thành công", "Đã thêm sinh viên mới vào hệ thống", "success");
  
      // Cập nhật danh sách
      setStudents((prev) => [...prev, res.data.student]);
      setIsAdding(false);
    } catch (err: any) {
      console.error("Lỗi khi thêm sinh viên:", err);
      Swal.fire(
        "Lỗi",
        err?.response?.data?.message || "Không thể thêm sinh viên",
        "error"
      );
    }
  };
  

  const handleDeleteStudent = async (tdt_id: string, userId: string) => {
    const result = await Swal.fire({
      title: "Xác nhận xoá",
      text: "Bạn có chắc muốn xoá sinh viên này khỏi lớp không?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xoá",
      cancelButtonText: "Huỷ",
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(
          `http://localhost:4000/api/classes/${classId}/remove-student/${userId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setStudents((prev) => prev.filter((s) => s.tdt_id !== tdt_id));
        Swal.fire("Đã xoá!", "Sinh viên đã được xoá khỏi lớp.", "success");
      } catch (error) {
        console.error("Lỗi khi xoá sinh viên khỏi lớp:", error);
        Swal.fire("Lỗi", "Không thể xoá sinh viên khỏi lớp.", "error");
      }
    }
  }; 

  return (
    <div className="w-full h-full bg-white">
      <div className="h-full mx-auto overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-bold text-2xl text-blue-950">
            Thông tin sinh viên
          </h1>
          <div className="flex gap-2">
            <input
              placeholder="Tìm kiếm"
              className="border rounded-md px-2"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            {isAdmin && (
              <select
                className="border rounded-md px-2"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <option value="">Tất cả lớp</option>
                {availableClasses.map((cls) => (
                  <option key={cls.class_id} value={cls.class_id}>
                    {cls.class_id} - {cls.class_name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="bg-blue-700 hover:bg-blue-800 cursor-pointer flex items-center gap-1 text-white px-3 py-2 rounded-xl"
              onClick={() => setIsAdding(true)}
            >
              <IoMdAdd className="text-white font-bold" />
              Thêm sinh viên
            </button>

            <input
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              id="csvUpload"
              onChange={(e) => handleImportCSV(e)}
            />
          </div>
        </div>

        {isAdding && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
            <div className="bg-white p-6 rounded-md w-3/5 mx-auto shadow-2xl">
              <h2 className="text-xl mb-4 font-bold text-blue-700">
                Thêm Sinh Viên
              </h2>
              <form onSubmit={handleSubmit}>
              {isAdvisor ? (
                <>
                  <input
                    type="email"
                    name="email"
                    placeholder="Email sinh viên"
                    value={newStudent.email}
                    onChange={handleInputChange}
                    required
                    className="border rounded-md px-2 mb-4 w-full py-2"
                  />
                  <p className="text-sm italic text-gray-500 mt-1">
                    Chú ý: Chỉ thêm email sinh viên đã có trong hệ thống
                  </p>
                </>
                ) : (
                  <>
                <input
                  type="text"
                  name="name"
                  placeholder="Họ và tên"
                  value={newStudent.name}
                  onChange={handleInputChange}
                  required
                  className="border rounded-md px-2 mb-4 w-full py-2"
                />
                <input
                  type="text"
                  name="tdt_id"
                  placeholder="Mã số sinh viên"
                  value={newStudent.tdt_id}
                  onChange={handleInputChange}
                  required
                  className="border rounded-md px-2 mb-4 w-full py-2"
                />
                <select
                  name="gender"
                  value={newStudent.gender}
                  onChange={handleInputChange}
                  required
                  className="border rounded-md px-2 mb-4 w-full py-2"
                >
                  <option value="">Chọn giới tính</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={newStudent.dateOfBirth}
                  onChange={handleInputChange}
                  required
                  className="border rounded-md px-2 mb-4 w-full py-2"
                />
                <input
                  type="text"
                  name="phoneNumber"
                  placeholder="Số điện thoại"
                  value={newStudent.phoneNumber}
                  onChange={handleInputChange}
                  required
                  className="border rounded-md px-2 mb-4 w-full py-2"
                />
                <input
                  type="text"
                  name="parentPhoneNumber"
                  placeholder="Số điện thoại phụ huynh"
                  value={newStudent.parentPhoneNumber}
                  onChange={handleInputChange}
                  required
                  className="border rounded-md px-2 mb-4 w-full py-2"
                />
                <input
                  type="text"
                  name="address"
                  placeholder="Địa chỉ"
                  value={newStudent.address}
                  onChange={handleInputChange}
                  required
                  className="border rounded-md px-2 mb-4 w-full py-2"
                />
                </>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                  >
                    Thêm
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-md"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <StudentList 
          role={user.role}
          students={filteredStudents}
          onDelete={(tdt_id) => {
            const user = students.find((s) => s.tdt_id === tdt_id);
            if (user) handleDeleteStudent(tdt_id, user._id);
          }} 
          classId={classId} setStudents={setStudents}/>
      </div>
    </div>
  );
};

export default StudentInfor;
