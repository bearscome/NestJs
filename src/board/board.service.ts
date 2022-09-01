import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BoardCommentRepository } from "src/board/repository/board.comment.repository";
import { BoardRepository } from "src/board/repository/board.repository";
import {
  BoardDTO,
  BoardHistroy,
  BoardResponseStatus,
  CreateBoardDTO,
  GetHistoryBoardDTO,
  UpdateBoardDTO,
} from "src/board/dto/board.dto";
import { ResponseData } from "src/auth/dto/user.dto";
import { Board } from "src/domain/board.entity";
import { BoardAnswerAddDTD, BoardAnswerDTO } from "./dto/board.answer.dto";
import { BoardAnswerRepository } from "./repository/board.answer.repository";

@Injectable()
export class BoardService {
  constructor(
    @InjectRepository(BoardRepository) private boardRepository: BoardRepository,
    @InjectRepository(BoardCommentRepository)
    private commentRepository: BoardRepository,
    @InjectRepository(BoardAnswerRepository)
    private boardAnswerRepository: BoardAnswerRepository
  ) {}

  /**
   * 게시판 상세 조회
   * @param borad_id 게시판 고유 아이디
   * @returns 게시판 상세
   */
  async findBoard(borad_id: number): Promise<Board> {
    // 게시글 고유 아이디 get,
    // 사용자가 작성했는지 확인해야하지만 -> jwt인증하니까, 굳이 할 필요가 없을 거 같다.
    const findBoard = await this.boardRepository.findOne({
      where: { borad_id },
    });
    const comment = await findBoard.comments;

    console.warn("findBoard", findBoard);
    // Javascript 혹은 Node.js에서는 Lazy Loading을 사용하기 위해서는 Promise가 사용됩니다. 이것은 비표준 방법이며 TypeOrm에서의 실험적인 기능입니다.
    return findBoard;
  }

  async refCountBy(ref: number): Promise<number> {
    return await this.boardRepository.countBy({ ref });
  }

  async createBoard(createBoardDTO: CreateBoardDTO): Promise<CreateBoardDTO> {
    console.log(createBoardDTO);
    return await this.boardRepository.save(createBoardDTO);
    // 게시글 생성 서비스 로직
  }

  async deleteBoard(board_id: number): Promise<BoardResponseStatus> {
    // return await this.boardRepository.delete()
    // 게시글 삭제 서비스 로직
    const boardInfo = await this.findBoard(board_id);

    let result: BoardResponseStatus = {
      status: 0,
      message: "",
    };

    if (!boardInfo) {
      result.status = 4001;
      result.message = "이미 삭제되었거나, 존재하지 않는 게시물 입니다.";
      return result;
    }

    const { borad_id } = boardInfo;
    try {
      result = await this.boardRepository.delete({ borad_id }).then(() => {
        return {
          status: 4000,
          message: "삭제 완료되었습니다.",
        };
      });

      return result;
    } catch (err) {
      console.error("deleteBoard_ERR", err);
      result.status = 4999;
      result.message = "알수없는 오류가 발생하였습니다.";
      return result;
    }
  }

  async deleteBoardAll(): Promise<boolean> {
    const boardList = await this.boardRepository.find({
      select: {
        borad_id: true,
      },
    });

    const deleteList = async () => {
      let result = false;
      let listCount = boardList.length;

      const tt = await boardList.reduce(async (prev, cur) => {
        await prev;
        await this.boardRepository
          .delete({ borad_id: cur.borad_id })
          .then((res) => {
            listCount--;
            console.log("listCount, ", listCount);
            console.log("res, ", res);
            if (listCount === 0) {
              result = true;
            }
          });

        return {
          cur,
        };
      }, {});

      if (listCount === 0) {
        return true;
      } else {
        return false;
      }
    };

    // boardList.forEach(async ({ borad_id }) => {
    //   await this.boardRepository.delete({ borad_id }).then(() => {
    //     listCount--;
    //     console.log(listCount);
    //     if (listCount === 0) {
    //       console.log("다 끝났다.");
    //       result = true;
    //     } else {
    //       console.log("아직 남았다.");
    //     }
    //   });
    // });

    // const tt = await boardList.reduce(async (prev, current) => {
    //   console.log("prev", await prev, current);
    //   const result = await this.boardRepository.delete({
    //     borad_id: current.borad_id,
    //   });
    //   return {
    //     ...(await prev),
    //     ...result,
    //   };
    // }, {});

    // console.log("boardList ", tt);

    return await deleteList();
  }

  async updateBoard(
    updateBoardDTO: UpdateBoardDTO
  ): Promise<BoardResponseStatus> {
    // 게시글 수정 서비스 로직
    const { id, title, content } = updateBoardDTO;
    let result: { status: number; message: string } = {
      status: 0,
      message: "",
    };

    const boardInfo = await this.findBoard(Number(id));

    console.log("boardInfoboardInfo", boardInfo);

    if (!boardInfo) {
      result.status = 4001;
      result.message = "존재하지 않는 게시물 입니다.";
      return result;
    }

    const data = {
      ...boardInfo,
      title,
      content,
    };

    try {
      result = await this.boardRepository.save(data).then(() => {
        return {
          status: 4000,
          message: "삭제 완료되었습니다.",
        };
      });

      return result;
    } catch (err) {
      console.error("deleteBoard_ERR", err);
      result.status = 4999;
      result.message = "알수없는 오류가 발생하였습니다.";
      return result;
    }
  }

  async history({
    offset,
    limit,
  }: GetHistoryBoardDTO): Promise<BoardHistroy | BoardResponseStatus> {
    let result: {
      status: number;
      message: string;
      result: Array<Board | []>;
      total: number;
    } = {
      status: 0,
      message: "",
      result: [],
      total: 0,
    };

    try {
      const [boardList, total] = await Promise.all([
        this.boardRepository.manager.query(
          `SELECT * FROM board ORDER BY IF(ref = 0, borad_id , ref) DESC, orderby LIMIT ${offset}, ${limit}`
        ),
        this.boardRepository.count(),
      ]);

      if (boardList.length < 1) {
        result.status = 4001;
        result.message = "게시물이 없습니다.";
      }

      result.status = 4000;
      result.message = "조회가 완료되었습니다.";
      result.total = total;
      result.result = boardList;

      // result = await this.boardRepository
      //   .findAndCount({
      //     skip: offset,
      //     take: limit,
      //     order: { ref: "DESC", orderby: "ASC" },
      //     // order: { borad_id: "DESC" },
      //     // ASC: 오름차순 1,2,3
      //     // DESC: 내림차순 33,32,31
      //   })
      //   .then(([_result, _total]) => {
      //     if (_result.length < 1) {
      //       result.status = 4001;
      //       result.message = "존재하지 않는 게시물 입니다.";
      //     } else {
      //       result.status = 4000;
      //       result.message = "조회가 완료되었습니다.";
      //       result.total = _total;
      //       result.result = _result;
      //     }
      //     return result;
      //   });
    } catch (err) {
      console.error("histroy_ERR", err);
      result.status = 4999;
      result.message = "알수없는 오류가 발생하였습니다.";
      return result;
    }

    return result;
  }

  async searchBoard({
    searchType,
    searchContent,
    limit,
    offset,
  }): Promise<any> {
    let result: {
      status: number;
      message: string;
      result: Array<Board | []>;
      total: number;
    } = {
      status: 0,
      message: "",
      result: [],
      total: 0,
    };

    const [boardList, total] = await Promise.all([
      this.boardRepository.manager.query(
        `SELECT * FROM board WHERE ${searchType} like '%${searchContent}%' ORDER BY IF(ref = 0, borad_id , ref) DESC, orderby LIMIT ${offset}, ${limit}`
      ),
      this.boardRepository.manager.query(
        `SELECT COUNT(*) as total FROM board WHERE ${searchType} like '%${searchContent}%'`
      ),
    ]);

    result.status = 4000;
    result.message = "조회가 완료되었습니다.";
    result.total = total[0].total;
    result.result = boardList;

    return result;
  }

  async addComment(insertData: {
    username: string;
    board_id: number;
    content: string;
  }): Promise<Board> {
    /**
     * 게시판 고유 번호
     * 댓글 글쓴이
     * 댓글 내용
     */
    return await this.commentRepository.save(insertData);
  }

  async addAnswer(addAnswerDto: BoardAnswerAddDTD): Promise<Board> {
    // https://whitemackerel.tistory.com/55
    const { board_id, username, title, content, indent } = addAnswerDto;
    // const data = await this.findBoard(board_id);
    const refCount = await this.refCountBy(board_id);
    const setOrderBy = refCount + 1;
    const insertData = {
      username,
      title,
      content,
      indent,
      ref: board_id,
      orderby: setOrderBy,
    };
    console.log("add", insertData);
    return await this.boardRepository.save(insertData);
  }
}
